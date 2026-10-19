import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Company from "../modules/sales/models/company.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import { EmailProviderFactory } from "../modules/sales/integrations/email/email.factory.js";
import { WhatsAppProviderFactory } from "../modules/sales/integrations/whatsapp/whatsapp.factory.js";

describe("INB-001: Unified Communication Inbox API & Thread Aggregator", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testCompany: any;
  let testContact: any;
  let testLead: any;
  let testDeal: any;
  let testPipeline: any;

  const testPrefix = `inb-test-${Date.now()}`;
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdPipelineIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    // Force mock drivers for test environment
    process.env.SALES_EMAIL_DRIVER = "mock";
    process.env.SALES_WHATSAPP_DRIVER = "mock";
    EmailProviderFactory.clearCache();
    WhatsAppProviderFactory.clearCache();

    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Inbox Test Org ${testPrefix}`,
      slug: `inb-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `inb-admin-${testPrefix}@talnova.test`,
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
        email: `inb-user-${testPrefix}@talnova.test`,
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

    testCompany = await Company.create({
      name: `Apex Global ${testPrefix}`,
      domain: `apex-${testPrefix}.test`,
      industry: "Technology",
      status: "customer",
      tags: ["enterprise"],
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      companyId: testCompany._id,
      firstName: "Sarah",
      lastName: "Connor",
      fullName: "Sarah Connor",
      email: `sarah-${testPrefix}@apex.test`,
      normalizedEmail: `sarah-${testPrefix}@apex.test`,
      phone: "+15550001111",
      jobTitle: "CTO",
      role: "buyer",
      isPrimaryDecisionMaker: true,
      consent: {
        emailMarketing: true,
        whatsappMarketing: true,
      },
    });
    createdContactIds.push(testContact._id);

    testLead = await Lead.create({
      name: `Marcus Wright`,
      firstName: "Marcus",
      lastName: "Wright",
      email: `marcus-${testPrefix}@skynet.test`,
      normalizedEmail: `marcus-${testPrefix}@skynet.test`,
      phone: "+15552223333",
      companyName: `Skynet Systems ${testPrefix}`,
      jobTitle: "Head of Operations",
      status: "qualified",
      leadScore: 85,
      consent: {
        emailMarketing: true,
        whatsappMarketing: true,
      },
    });
    createdLeadIds.push(testLead._id);

    testPipeline = await Pipeline.create({
      name: `Sales Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "lead", name: "Lead", probability: 0.1, order: 1 },
        { key: "proposal", name: "Proposal", probability: 0.7, order: 2 },
        { key: "closed_won", name: "Closed Won", probability: 1.0, order: 3 },
      ],
    });
    createdPipelineIds.push(testPipeline._id);

    testDeal = await Deal.create({
      name: `Apex Enterprise Cloud Suite`,
      companyId: testCompany._id,
      primaryContactId: testContact._id,
      pipelineId: testPipeline._id,
      value: 125000,
      currency: "USD",
      annualRecurringRevenue: 100000,
      oneTimeImplementationFee: 25000,
      stage: "proposal",
      probability: 0.7,
      status: "open",
    });
    createdDealIds.push(testDeal._id);
  });

  afterAll(async () => {
    if (createdThreadIds.length) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (createdDealIds.length) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdPipelineIds.length) {
      await Pipeline.deleteMany({ _id: { $in: createdPipelineIds } });
    }
    if (createdContactIds.length) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
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

  describe("1. RBAC & Security Boundaries", () => {
    it("should return 401 Unauthorized when accessing inbox without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 Forbidden when accessed by non-super_admin user", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("2. Thread Creation & Auto-Linkage", () => {
    it("should create a new outbound email thread with auto-linking to matching Contact", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/inbox",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          channel: "email",
          recipient: `sarah-${testPrefix}@apex.test`,
          subject: "Talnova Platform Architecture Overview",
          body: "Hello Sarah, here is the architectural summary we discussed.",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.channel).toBe("email");
      expect(body.data.subject).toBe("Talnova Platform Architecture Overview");
      expect(body.data.messages.length).toBe(1);
      expect(body.data.messages[0].direction).toBe("outbound");
      expect(body.data.messages[0].body).toContain("architectural summary");
      // Verify auto linkage
      expect(body.data.contactId._id || body.data.contactId).toBe(testContact._id.toString());
      expect(body.data.companyId._id || body.data.companyId).toBe(testCompany._id.toString());

      createdThreadIds.push(new mongoose.Types.ObjectId(body.data._id));
    });

    it("should create a new outbound WhatsApp thread with auto-linking to matching Lead", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/inbox",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          channel: "whatsapp",
          recipient: "+15552223333",
          subject: "Marcus Onboarding Check-in",
          body: "Hi Marcus, checking in on your team onboarding setup.",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.channel).toBe("whatsapp");
      expect(body.data.leadId._id || body.data.leadId).toBe(testLead._id.toString());

      createdThreadIds.push(new mongoose.Types.ObjectId(body.data._id));
    });
  });

  describe("3. Thread Listing, Filtering, and Counters", () => {
    let unreadEmailThread: any;
    let resolvedWaThread: any;

    beforeAll(async () => {
      // Create seed threads for comprehensive filter verification
      unreadEmailThread = await CommThread.create({
        channel: "email",
        leadId: testLead._id,
        status: "open",
        subject: `Inbound Inquiry from Marcus`,
        lastMessageSnippet: "Can we schedule a 15 min demo call?",
        lastMessageAt: new Date(Date.now() - 3600000),
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: testLead.email,
            to: ["sales@talnova.io"],
            subject: "Demo Request",
            body: "Can we schedule a 15 min demo call?",
            status: "delivered", // Unread!
            sentAt: new Date(Date.now() - 3600000),
          },
        ],
      });
      createdThreadIds.push(unreadEmailThread._id);

      resolvedWaThread = await CommThread.create({
        channel: "whatsapp",
        contactId: testContact._id,
        companyId: testCompany._id,
        dealId: testDeal._id,
        assignedTo: superAdminUser._id,
        status: "resolved",
        subject: "WhatsApp Support Session",
        lastMessageSnippet: "Ticket resolved. Thanks!",
        lastMessageAt: new Date(Date.now() - 7200000),
        messages: [
          {
            channel: "whatsapp",
            direction: "inbound",
            from: testContact.phone,
            to: ["+18005550000"],
            body: "Need help with API key.",
            status: "read",
            sentAt: new Date(Date.now() - 8000000),
          },
          {
            channel: "whatsapp",
            direction: "outbound",
            from: "+18005550000",
            to: [testContact.phone],
            body: "Ticket resolved. Thanks!",
            status: "sent",
            sentAt: new Date(Date.now() - 7200000),
          },
        ],
      });
      createdThreadIds.push(resolvedWaThread._id);
    });

    it("should list threads with pagination and counter aggregates", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox?page=1&limit=10",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
      expect(body.pagination.total).toBeGreaterThanOrEqual(4);
      expect(body.counters).toBeDefined();
      expect(body.counters.unread).toBeGreaterThanOrEqual(1);
      expect(body.counters.resolved).toBeGreaterThanOrEqual(1);
    });

    it("should filter threads by channel=whatsapp", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox?channel=whatsapp",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.every((t: any) => t.channel === "whatsapp")).toBe(true);
    });

    it("should filter threads by status=resolved", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox?status=resolved",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.every((t: any) => t.status === "resolved")).toBe(true);
      expect(body.data.some((t: any) => t._id === resolvedWaThread._id.toString())).toBe(true);
    });

    it("should filter unread threads only", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox?unreadOnly=true",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.some((t: any) => t._id === unreadEmailThread._id.toString())).toBe(true);
      // Resolved thread has all messages read, so it should not appear
      expect(body.data.some((t: any) => t._id === resolvedWaThread._id.toString())).toBe(false);
    });

    it("should search threads by keyword across subject or message body", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/inbox?search=demo%20call`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.some((t: any) => t._id === unreadEmailThread._id.toString())).toBe(true);
    });
  });

  describe("4. Retrieve Single Thread & Message History", () => {
    it("should return 400 for invalid thread id", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/inbox/invalid-thread-id",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("INVALID_THREAD_ID");
    });

    it("should return 404 for non-existent thread", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/inbox/${nonExistentId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().code).toBe("THREAD_NOT_FOUND");
    });

    it("should retrieve single thread with populated entities and message history", async () => {
      const targetThreadId = createdThreadIds[createdThreadIds.length - 1];
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/inbox/${targetThreadId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data._id).toBe(targetThreadId.toString());
      expect(Array.isArray(body.data.messages)).toBe(true);
      expect(body.data.messages.length).toBeGreaterThan(0);
    });
  });

  describe("5. Outbound Reply Dispatching (Email & WhatsApp)", () => {
    it("should dispatch outbound email reply via provider and append to thread messages", async () => {
      // Find an email thread
      const emailThread = await CommThread.findOne({
        _id: { $in: createdThreadIds },
        channel: "email",
      });
      expect(emailThread).toBeDefined();

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/inbox/${emailThread!._id}/reply`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          body: "Thank you for reaching out! We are delighted to confirm your demo slot.",
          subject: "Re: Demo Request Confirmation",
          status: "pending",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("pending");
      expect(body.data.lastMessageSnippet).toContain("Thank you for reaching out");

      const latestMessage = body.data.messages[body.data.messages.length - 1];
      expect(latestMessage.direction).toBe("outbound");
      expect(latestMessage.channel).toBe("email");
      expect(latestMessage.status).toBe("sent");
      expect(latestMessage.providerMessageId).toBeDefined();
    });

    it("should dispatch outbound WhatsApp reply via provider with E.164 normalization", async () => {
      // Find a whatsapp thread
      const waThread = await CommThread.findOne({
        _id: { $in: createdThreadIds },
        channel: "whatsapp",
      });
      expect(waThread).toBeDefined();

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/inbox/${waThread!._id}/reply`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          body: "Here is your updated WhatsApp support verification code: 994821.",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);

      const latestMessage = body.data.messages[body.data.messages.length - 1];
      expect(latestMessage.direction).toBe("outbound");
      expect(latestMessage.channel).toBe("whatsapp");
      expect(latestMessage.status).toBe("sent");
      expect(latestMessage.body).toContain("994821");
    });
  });

  describe("6. Thread Updates & Read Tracking", () => {
    it("should update thread status to resolved and assign owner", async () => {
      const thread = await CommThread.findOne({ _id: { $in: createdThreadIds } });
      expect(thread).toBeDefined();

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/inbox/${thread!._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          status: "resolved",
          assignedTo: superAdminUser._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("resolved");
      expect(body.data.assignedTo._id || body.data.assignedTo).toBe(superAdminUser._id.toString());
    });

    it("should mark thread as read via POST /api/v1/sales/inbox/:id/read", async () => {
      // Create thread with an unread message
      const unreadThread = await CommThread.create({
        channel: "email",
        status: "open",
        subject: "Unread Notice",
        lastMessageSnippet: "Important notice",
        lastMessageAt: new Date(),
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: "client@example.com",
            to: ["sales@talnova.io"],
            body: "Important notice body",
            status: "delivered", // unread
            sentAt: new Date(),
          },
        ],
      });
      createdThreadIds.push(unreadThread._id);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/inbox/${unreadThread._id}/read`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.messages[0].status).toBe("read");
    });
  });
});
