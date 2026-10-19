import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Campaign from "../modules/sales/models/campaign.model.js";
import CampaignTemplate from "../modules/sales/models/campaign-template.model.js";
import CampaignDispatcherService from "../modules/sales/services/campaign-dispatcher.service.js";
import { processCampaignBatchJob } from "../modules/sales/workers/campaign.worker.js";
import { QueueService, Job } from "../infrastructure/queue/queue.service.js";
import { MockEmailDriver } from "../modules/sales/integrations/email/mock.driver.js";
import { EmailProviderFactory } from "../modules/sales/integrations/email/email.factory.js";
import { WhatsAppProviderFactory } from "../modules/sales/integrations/whatsapp/whatsapp.factory.js";
import { MockWhatsAppDriver } from "../modules/sales/integrations/whatsapp/mock-whatsapp.driver.js";

describe("CAMP-005: Background Campaign Batch Dispatcher", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;

  const testPrefix = `disp-test-${Date.now()}`;
  const createdCampaignIds: mongoose.Types.ObjectId[] = [];
  const createdTemplateIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  const dispatcherService = new CampaignDispatcherService();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Dispatcher Test Org ${testPrefix}`,
      slug: `disp-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `disp-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
      },
      roles: ["super_admin"],
      systemRole: "super_admin",
      status: "Active",
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `disp-user-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Sales",
        lastName: "Rep",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "Active",
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      id: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      roles: ["super_admin"],
      organizationId: testOrg._id.toString(),
    });

    regularToken = app.jwt.sign({
      id: regularUser._id.toString(),
      email: regularUser.auth.email,
      roles: ["employee"],
      organizationId: testOrg._id.toString(),
    });

    // Clear provider buffers
    MockEmailDriver.clearSentEmails();
    MockWhatsAppDriver.clearSentMessages();
  });

  afterAll(async () => {
    if (createdCampaignIds.length) {
      await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    }
    if (createdTemplateIds.length) {
      await CampaignTemplate.deleteMany({ _id: { $in: createdTemplateIds } });
    }
    if (createdLeadIds.length) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdUserIds.length) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    await app.close();
    await disconnectDatabase();
  });

  describe("1. Batch Partitioning & Rate Limiting Calculation", () => {
    it("should partition 120 recipients into 3 batches with calculated rate limit delays", async () => {
      // Create campaign with 120 recipients
      const recipients = Array.from({ length: 120 }, (_, i) => ({
        recipientEmail: `user${i}-${testPrefix}@example.com`,
        recipientName: `User ${i}`,
        status: "pending" as const,
      }));

      const campaign = await Campaign.create({
        name: `Rate Limit Test Campaign ${testPrefix}`,
        channel: "email",
        status: "draft",
        subject: "Speed & Scale Test",
        content: "<p>Hello {{firstName}}</p>",
        createdBy: superAdminUser._id,
        recipients,
        stats: { totalRecipients: 120 },
      });
      createdCampaignIds.push(campaign._id);

      // Launch with batchSize: 50, rateLimit: 14/sec
      const result = await dispatcherService.launchCampaign(campaign._id.toString(), {
        batchSize: 50,
        rateLimitPerSecond: 14,
      });

      expect(result.status).toBe("sending");
      expect(result.totalBatches).toBe(3); // 50 + 50 + 20
      expect(result.totalRecipients).toBe(120);

      // Check campaign state in DB
      const updated = await Campaign.findById(campaign._id);
      expect(updated?.status).toBe("sending");
      expect(updated?.startedAt).toBeDefined();
    });
  });

  describe("2. Live Worker Dispatch Execution (Email)", () => {
    it("should process campaign batch job, invoke provider, and update recipient records to sent", async () => {
      const recipients = [
        {
          recipientEmail: `lead1-${testPrefix}@acme.test`,
          recipientName: "Arthur Dent",
          status: "pending" as const,
        },
        {
          recipientEmail: `lead2-${testPrefix}@acme.test`,
          recipientName: "Ford Prefect",
          status: "pending" as const,
        },
      ];

      const campaign = await Campaign.create({
        name: `Worker Test Campaign ${testPrefix}`,
        channel: "email",
        status: "sending",
        subject: "Greetings {{firstName}}, from the Galaxy",
        content: "<h1>Welcome {{firstName}}!</h1>",
        createdBy: superAdminUser._id,
        recipients,
        stats: { totalRecipients: 2, sentCount: 0, failedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      // Execute worker directly on batch
      const job: Job = {
        id: new mongoose.Types.ObjectId().toString(),
        name: "sales:campaign:dispatch_batch",
        data: {
          campaignId: campaign._id.toString(),
          batchIndex: 0,
          recipientIds: campaign.recipients.map((r) => (r as any)._id.toString()),
        },
        options: { organizationId: testOrg._id.toString() },
        status: "processing",
        attempts: 1,
        availableAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await processCampaignBatchJob(job);

      // Verify campaign was updated to completed
      const finished = await Campaign.findById(campaign._id);
      expect(finished?.status).toBe("completed");
      expect(finished?.stats.sentCount).toBe(2);
      expect(finished?.stats.failedCount).toBe(0);
      expect(finished?.completedAt).toBeDefined();

      // Verify recipients have providerMessageId and sentAt
      expect(finished?.recipients[0].status).toBe("sent");
      expect(finished?.recipients[0].providerMessageId).toBeDefined();
      expect(finished?.recipients[0].sentAt).toBeDefined();
      expect(finished?.recipients[1].status).toBe("sent");
    });
  });

  describe("3. Pause, Resume, and Cancellation Controls", () => {
    let controllableCampaignId: string;

    beforeAll(async () => {
      const recipients = Array.from({ length: 6 }, (_, i) => ({
        recipientEmail: `controllable${i}-${testPrefix}@example.test`,
        recipientName: `Person ${i}`,
        status: "pending" as const,
      }));

      const campaign = await Campaign.create({
        name: `Controllable Campaign ${testPrefix}`,
        channel: "email",
        status: "draft",
        subject: "Pause and Resume Test",
        content: "<p>Hi {{firstName}}</p>",
        createdBy: superAdminUser._id,
        recipients,
        stats: { totalRecipients: 6, sentCount: 0, failedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);
      controllableCampaignId = campaign._id.toString();
    });

    it("should launch campaign via API endpoint POST /:id/launch", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${controllableCampaignId}/launch`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { batchSize: 2, rateLimitPerSecond: 20 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("sending");
      expect(body.data.totalBatches).toBe(3);
    });

    it("should pause campaign via API endpoint POST /:id/pause", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${controllableCampaignId}/pause`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("paused");
    });

    it("should immediately halt worker execution when campaign is paused", async () => {
      const campaign = await Campaign.findById(controllableCampaignId);
      const pendingRecipients = campaign?.recipients.filter((r) => r.status === "pending") || [];
      expect(pendingRecipients.length).toBeGreaterThan(0);

      const job: Job = {
        id: new mongoose.Types.ObjectId().toString(),
        name: "sales:campaign:dispatch_batch",
        data: {
          campaignId: controllableCampaignId,
          batchIndex: 1,
          recipientIds: pendingRecipients.map((r) => (r as any)._id.toString()),
        },
        options: { organizationId: testOrg._id.toString() },
        status: "processing",
        attempts: 1,
        availableAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Process job while campaign is in paused state
      await processCampaignBatchJob(job);

      // Verify pending recipients were NOT sent
      const verifyCampaign = await Campaign.findById(controllableCampaignId);
      expect(verifyCampaign?.status).toBe("paused");
      const stillPending = verifyCampaign?.recipients.filter((r) => r.status === "pending").length;
      expect(stillPending).toBe(pendingRecipients.length);
    });

    it("should resume campaign via API endpoint POST /:id/resume", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${controllableCampaignId}/resume`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { batchSize: 2 },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("sending");
    });

    it("should cancel campaign via API endpoint POST /:id/cancel", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${controllableCampaignId}/cancel`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("cancelled");
    });

    it("should reject launching a cancelled campaign", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${controllableCampaignId}/launch`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).code).toBe("INVALID_STATE");
    });
  });

  describe("4. Live WhatsApp Campaign Dispatch", () => {
    it("should dispatch WhatsApp template messages to the WhatsApp provider", async () => {
      const recipients = [
        {
          recipientPhone: "+15551112222",
          recipientName: "Zaphod Beeblebrox",
          status: "pending" as const,
        },
      ];

      const campaign = await Campaign.create({
        name: `WhatsApp Dispatch Test ${testPrefix}`,
        channel: "whatsapp",
        status: "sending",
        whatsappTemplateName: "welcome_onboarding",
        whatsappLanguageCode: "en",
        whatsappParameters: { param1: "Zaphod" },
        createdBy: superAdminUser._id,
        recipients,
        stats: { totalRecipients: 1, sentCount: 0, failedCount: 0 },
      });
      createdCampaignIds.push(campaign._id);

      const job: Job = {
        id: new mongoose.Types.ObjectId().toString(),
        name: "sales:campaign:dispatch_batch",
        data: {
          campaignId: campaign._id.toString(),
          batchIndex: 0,
          recipientIds: [campaign.recipients[0]._id.toString()],
        },
        options: { organizationId: testOrg._id.toString() },
        status: "processing",
        attempts: 1,
        availableAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await processCampaignBatchJob(job);

      const updated = await Campaign.findById(campaign._id);
      expect(updated?.status).toBe("completed");
      expect(updated?.stats.sentCount).toBe(1);
      expect(updated?.recipients[0].status).toBe("sent");
      expect(updated?.recipients[0].providerMessageId).toBeDefined();
    });
  });

  describe("5. Execution Status API Endpoint", () => {
    it("should return live execution status, counters, and progress percentage", async () => {
      const campaign = await Campaign.create({
        name: `Live Status Test ${testPrefix}`,
        channel: "email",
        status: "sending",
        createdBy: superAdminUser._id,
        recipients: [
          { recipientEmail: "a@test.com", status: "sent", sentAt: new Date() },
          { recipientEmail: "b@test.com", status: "sent", sentAt: new Date() },
          { recipientEmail: "c@test.com", status: "failed", errorMessage: "Bounced" },
          { recipientEmail: "d@test.com", status: "pending" },
        ],
        stats: {
          totalRecipients: 4,
          sentCount: 2,
          failedCount: 1,
        },
      });
      createdCampaignIds.push(campaign._id);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/sales/campaigns/${campaign._id.toString()}/status-live`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("sending");
      expect(body.data.totalRecipients).toBe(4);
      expect(body.data.sentCount).toBe(2);
      expect(body.data.failedCount).toBe(1);
      expect(body.data.pendingCount).toBe(1);
      expect(body.data.progressPercent).toBe(75); // (2 + 1) / 4 = 75%
    });

    it("should enforce super_admin RBAC on campaign launch endpoint", async () => {
      const dummyCampId = new mongoose.Types.ObjectId().toString();
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${dummyCampId}/launch`,
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
