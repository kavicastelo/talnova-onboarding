import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import Lead from "../modules/sales/models/lead.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import AIInsight from "../modules/sales/models/ai-insight.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { AIClientFactory } from "../modules/sales/ai/ai-client.factory.js";
import { ProviderNotConfiguredError } from "../modules/sales/ai/ai-provider.interface.js";

describe("AI-002: AI Lead Summarization & Action Recommender Service", () => {
  let app: FastifyInstance;
  const testPrefix = `ailead-${Date.now()}`;
  let superAdminUser: any;
  let regularUser: any;
  let superAdminToken: string;
  let regularToken: string;
  let testOrg: any;

  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdInsightIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase();
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    testOrg = await Organization.create({
      name: `AI Test Org ${testPrefix}`,
      slug: `ai-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ai-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "AI",
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
        email: `ai-user-${testPrefix}@talnova.test`,
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
  });

  afterAll(async () => {
    if (createdInsightIds.length > 0) {
      await AIInsight.deleteMany({ _id: { $in: createdInsightIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    await app.close();
    await disconnectDatabase();
  });

  beforeEach(() => {
    process.env.SALES_AI_DRIVER = "mock";
    AIClientFactory.clearCache();
    AIClientFactory.getMockDriver().reset();
  });

  describe("1. RBAC & Validation Security Boundaries", () => {
    it("should return 401 when request is not authenticated", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${new mongoose.Types.ObjectId()}/summarize`,
      });
      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when request is made by a non-super_admin user", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${new mongoose.Types.ObjectId()}/summarize`,
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it("should return 400 for invalid ObjectId lead parameter", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/leads/invalid-lead-id/summarize",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe("INVALID_ID");
    });

    it("should return 404 when lead does not exist", async () => {
      const randomId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${randomId}/summarize`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("2. AI Lead Summarization & Structured Output", () => {
    it("should generate structured executive summary and persist insight to MongoDB", async () => {
      // 1. Create a lead with notes
      const lead = await Lead.create({
        name: `Morgan Vance ${testPrefix}`,
        email: `morgan-${testPrefix}@acme-corp.test`,
        normalizedEmail: `morgan-${testPrefix}@acme-corp.test`,
        companyName: `Acme Global ${testPrefix}`,
        jobTitle: "VP of Engineering",
        industry: "Cloud & SaaS",
        companySize: "51-200",
        source: "product_demo",
        status: "contacted",
        priority: "normal",
        score: 65,
        tags: ["enterprise", "q4-budget"],
        notes: [
          {
            title: "Initial Demo Call",
            content: "Expressed dissatisfaction with current legacy HR vendor. Needs SOC2 and automated onboarding.",
            createdAt: new Date(),
          },
        ],
      });
      createdLeadIds.push(lead._id);

      // 2. Create communication thread
      const thread = await CommThread.create({
        channel: "email",
        status: "open",
        subject: "Acme Global - Onboarding Evaluation",
        counterparty: {
          name: lead.name,
          email: lead.email,
        },
        leadId: lead._id,
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: lead.email,
            to: ["sales@talnova.com"],
            subject: "Acme Global - Onboarding Evaluation",
            body: "Hi team, we need to finalize vendor selection before the end of the month.",
            sentAt: new Date(),
            status: "delivered",
          },
        ],
      });
      createdThreadIds.push(thread._id);

      // 3. Configure mock AI driver with structured response
      const mockResult = {
        summary: "Morgan Vance is the VP of Engineering at Acme Global evaluating Talnova for enterprise onboarding. Facing legacy tool friction with active Q4 budget.",
        buyerIntent: "high" as const,
        keyPainPoints: [
          "Legacy HR onboarding friction",
          "Requires SOC2 compliance guarantees",
          "Urgent end-of-month decision deadline",
        ],
        suggestedNextAction: "Send SOC2 security packet and propose a technical deep-dive with solutions engineering within 24h.",
        recommendedEmailSnippet: "Hi Morgan, attached is our complete SOC2 Type II report. Let's schedule a 20-minute technical review with our solutions team.",
        confidenceScore: 0.92,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockResult);

      // 4. Request summarization
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.leadId).toBe(lead._id.toString());
      expect(body.data.summary).toBe(mockResult.summary);
      expect(body.data.buyerIntent).toBe("high");
      expect(body.data.keyPainPoints).toEqual(mockResult.keyPainPoints);
      expect(body.data.suggestedNextAction).toBe(mockResult.suggestedNextAction);
      expect(body.data.recommendedEmailSnippet).toBe(mockResult.recommendedEmailSnippet);
      expect(body.data.confidenceScore).toBe(0.92);
      expect(body.data.cached).toBe(false);

      createdInsightIds.push(new mongoose.Types.ObjectId(body.data.insightId));

      // 5. Verify persistence in MongoDB AIInsight collection
      const savedInsight = await AIInsight.findById(body.data.insightId);
      expect(savedInsight).toBeDefined();
      expect(savedInsight!.targetType).toBe("lead");
      expect(savedInsight!.targetId!.toString()).toBe(lead._id.toString());
      expect(savedInsight!.priority).toBe("high");
      expect(savedInsight!.status).toBe("pending");
      expect(savedInsight!.metadata?.buyerIntent).toBe("high");

      // 6. Verify prompt structure passed to AI model
      const history = mockDriver.getCallHistory();
      expect(history).toHaveLength(1);
      const call = history[0];
      expect(call.prompt).toContain(lead.name);
      expect(call.prompt).toContain(lead.companyName);
      expect(call.prompt).toContain("Expressed dissatisfaction with current legacy HR vendor");
      expect(call.prompt).toContain("finalize vendor selection before the end of the month");
    });
  });

  describe("3. Caching & Cache Invalidation", () => {
    it("should return cached insight without re-calling AI model on repeated requests", async () => {
      const lead = await Lead.create({
        name: `Cached Lead ${testPrefix}`,
        email: `cached-${testPrefix}@test.com`,
        normalizedEmail: `cached-${testPrefix}@test.com`,
        companyName: `Cached Inc ${testPrefix}`,
        status: "new",
        score: 50,
      });
      createdLeadIds.push(lead._id);

      const mockResult1 = {
        summary: "First generation summary.",
        buyerIntent: "medium" as const,
        keyPainPoints: ["Pain 1"],
        suggestedNextAction: "Action 1",
        confidenceScore: 0.8,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockResult1);

      // First call -> generated
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = res1.json();
      expect(body1.data.cached).toBe(false);
      createdInsightIds.push(new mongoose.Types.ObjectId(body1.data.insightId));
      expect(mockDriver.getCallHistory()).toHaveLength(1);

      // Second call -> cached
      const res2 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.data.cached).toBe(true);
      expect(body2.data.insightId).toBe(body1.data.insightId);
      // AI model should NOT have been invoked again
      expect(mockDriver.getCallHistory()).toHaveLength(1);

      // Third call with forceRefresh: true -> re-generates
      const mockResult2 = {
        summary: "Refreshed second generation summary.",
        buyerIntent: "very_high" as const,
        keyPainPoints: ["Pain 1", "Pain 2"],
        suggestedNextAction: "Action 2",
        confidenceScore: 0.95,
      };
      mockDriver.enqueueResponse(mockResult2);

      const res3 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { forceRefresh: true },
      });
      expect(res3.statusCode).toBe(200);
      const body3 = res3.json();
      expect(body3.data.cached).toBe(false);
      expect(body3.data.summary).toBe("Refreshed second generation summary.");
      createdInsightIds.push(new mongoose.Types.ObjectId(body3.data.insightId));
      expect(mockDriver.getCallHistory()).toHaveLength(2);
    });
  });

  describe("4. Graceful Fallback When AI Provider is Unconfigured", () => {
    it("should return HTTP 400 with AI_NOT_CONFIGURED instead of 500 when provider missing", async () => {
      const lead = await Lead.create({
        name: `Unconfigured Lead ${testPrefix}`,
        email: `unconfigured-${testPrefix}@test.com`,
        normalizedEmail: `unconfigured-${testPrefix}@test.com`,
        companyName: `Unconfigured Co ${testPrefix}`,
        status: "new",
      });
      createdLeadIds.push(lead._id);

      // Simulate unconfigured provider error
      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.setSimulatedError(
        new ProviderNotConfiguredError(
          "openai",
          "No AI API key is configured. Please navigate to Sales Integrations to configure OpenAI or Google Gemini."
        )
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe("AI_NOT_CONFIGURED");
      expect(body.configured).toBe(false);
      expect(body.message).toContain("No AI API key is configured");
    });
  });

  describe("5. Historical Insights & Status Reviews", () => {
    it("should list all insights for a lead and allow status transition to accepted", async () => {
      const lead = await Lead.create({
        name: `Review Lead ${testPrefix}`,
        email: `review-${testPrefix}@test.com`,
        normalizedEmail: `review-${testPrefix}@test.com`,
        companyName: `Review Corp ${testPrefix}`,
        status: "engaged",
      });
      createdLeadIds.push(lead._id);

      const mockResult = {
        summary: "Lead review summary.",
        buyerIntent: "medium" as const,
        keyPainPoints: ["Budget cycle"],
        suggestedNextAction: "Follow up next quarter",
        confidenceScore: 0.85,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockResult);

      const sumRes = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/leads/${lead._id}/summarize`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      const insightId = sumRes.json().data.insightId;
      createdInsightIds.push(new mongoose.Types.ObjectId(insightId));

      // Get insights list
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/sales/ai/leads/${lead._id}/insights`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(listRes.statusCode).toBe(200);
      const listBody = listRes.json();
      expect(listBody.success).toBe(true);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0]._id).toBe(insightId);
      expect(listBody.data[0].status).toBe("pending");

      // Update status to accepted
      const patchRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/ai/insights/${insightId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "accepted" },
      });
      expect(patchRes.statusCode).toBe(200);
      const patchBody = patchRes.json();
      expect(patchBody.success).toBe(true);
      expect(patchBody.data.status).toBe("accepted");
      expect(patchBody.data.reviewedAt).toBeDefined();
      expect(patchBody.data.reviewedBy).toBe(superAdminUser._id.toString());
    });
  });
});
