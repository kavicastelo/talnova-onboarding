import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import AIInsight from "../modules/sales/models/ai-insight.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { AIClientFactory } from "../modules/sales/ai/ai-client.factory.js";
import { ProviderNotConfiguredError } from "../modules/sales/ai/ai-provider.interface.js";

describe("AI-003: AI Deal Risk & Objection Analysis Service", () => {
  let app: FastifyInstance;
  const testPrefix = `airisk-${Date.now()}`;
  let superAdminUser: any;
  let regularUser: any;
  let superAdminToken: string;
  let regularToken: string;
  let testOrg: any;
  let testPipeline: any;
  let testCompany: any;
  let testContact: any;

  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdInsightIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase();
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    testOrg = await Organization.create({
      name: `AI Deal Risk Org ${testPrefix}`,
      slug: `ai-risk-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ai-deal-admin-${testPrefix}@talnova.test`,
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
        email: `ai-deal-user-${testPrefix}@talnova.test`,
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

    testPipeline = await Pipeline.create({
      name: `Risk Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "lead", name: "Lead", probability: 0.1, order: 1 },
        { key: "proposal", name: "Proposal", probability: 0.5, order: 2 },
        { key: "negotiation", name: "Negotiation", probability: 0.8, order: 3 },
      ],
    });

    testCompany = await Company.create({
      name: `Enterprise Dynamics ${testPrefix}`,
      domain: `edynamics-${testPrefix}.test`,
      industry: "Financial Services",
      status: "prospect",
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      firstName: "David",
      lastName: "Sterling",
      fullName: "David Sterling",
      email: `david-${testPrefix}@edynamics.test`,
      normalizedEmail: `david-${testPrefix}@edynamics.test`,
      phone: "+15554321098",
      companyId: testCompany._id,
      jobTitle: "Chief Information Officer",
    });
    createdContactIds.push(testContact._id);
  });

  afterAll(async () => {
    if (createdInsightIds.length > 0) {
      await AIInsight.deleteMany({ _id: { $in: createdInsightIds } });
    }
    if (createdTaskIds.length > 0) {
      await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (testPipeline) {
      await Pipeline.deleteOne({ _id: testPipeline._id });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
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
    it("should return 401 when request is unauthenticated", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${new mongoose.Types.ObjectId()}/analyze-risk`,
      });
      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when request is made by a non-super_admin user", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${new mongoose.Types.ObjectId()}/analyze-risk`,
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });
      expect(response.statusCode).toBe(403);
    });

    it("should return 400 for invalid ObjectId deal parameter", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/deals/not-a-valid-id/analyze-risk",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });
      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.code).toBe("INVALID_ID");
    });

    it("should return 404 when deal does not exist", async () => {
      const randomId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${randomId}/analyze-risk`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });
      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.code).toBe("NOT_FOUND");
    });
  });

  describe("2. AI Deal Risk Analysis, Objection Parsing & Health Score Update", () => {
    it("should analyze deal risk, detect objections, update deal healthScore, and persist insight", async () => {
      // 1. Create a deal in negotiation stage
      const deal = await Deal.create({
        name: `Enterprise Expansion ${testPrefix}`,
        organizationId: testOrg._id,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "negotiation",
        value: 120000,
        currency: "USD",
        annualRecurringRevenue: 100000,
        oneTimeImplementationFee: 20000,
        probability: 0.7,
        expectedCloseDate: new Date(Date.now() + 15 * 24 * 3600 * 1000),
        competitors: ["Workday", "BambooHR"],
        notes: "Client CFO is questioning multi-year commitment and requested a 15% discount.",
      });
      createdDealIds.push(deal._id);

      // 2. Create linked communication thread
      const thread = await CommThread.create({
        channel: "email",
        status: "open",
        subject: "Enterprise Expansion - Pricing Negotiation",
        counterparty: {
          name: testContact.firstName,
          email: testContact.email,
        },
        dealId: deal._id,
        companyId: testCompany._id,
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: testContact.email,
            to: ["sales@talnova.com"],
            subject: "Pricing Review",
            body: "Workday is offering a 3-year bundle with free onboarding. We need price parity or quarterly break clauses.",
            sentAt: new Date(),
            status: "delivered",
          },
        ],
      });
      createdThreadIds.push(thread._id);

      // 3. Create linked task
      const task = await SalesTask.create({
        title: "Address Pricing Objections",
        type: "proposal",
        priority: "high",
        dueDate: new Date(Date.now() + 48 * 3600 * 1000),
        dealId: deal._id,
        companyId: testCompany._id,
      });
      createdTaskIds.push(task._id);

      // 4. Configure Mock AI Driver response
      const mockRiskResult = {
        riskLevel: "high" as const,
        riskScore: 75,
        healthScore: 25,
        detectedObjections: [
          "CFO resistance to 3-year lock-in without break clause",
          "Competitive pricing pressure from Workday free onboarding bundle",
        ],
        competitorMentions: ["Workday"],
        recommendedAction: "Offer 1-year contract with opt-out clause at month 12 and 50% implementation fee credit",
        rescuePlaybook: "Counter Workday bundle by demonstrating 4x faster deployment velocity and offer annual exit clause.",
        confidenceScore: 0.94,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockRiskResult);

      // 5. Invoke analyze-risk endpoint
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.dealId).toBe(deal._id.toString());
      expect(body.data.riskLevel).toBe("high");
      expect(body.data.riskScore).toBe(75);
      expect(body.data.healthScore).toBe(25);
      expect(body.data.detectedObjections).toEqual(mockRiskResult.detectedObjections);
      expect(body.data.competitorMentions).toEqual(["Workday"]);
      expect(body.data.recommendedAction).toBe(mockRiskResult.recommendedAction);
      expect(body.data.rescuePlaybook).toBe(mockRiskResult.rescuePlaybook);
      expect(body.data.cached).toBe(false);

      createdInsightIds.push(new mongoose.Types.ObjectId(body.data.insightId));

      // 6. Verify Deal document was updated in MongoDB
      const updatedDeal = await Deal.findById(deal._id);
      expect(updatedDeal).toBeDefined();
      expect(updatedDeal!.healthScore).toBe(25);
      expect(updatedDeal!.riskFlags).toEqual(mockRiskResult.detectedObjections);
      expect(updatedDeal!.nextAction).toBe(mockRiskResult.recommendedAction);

      // 7. Verify AIInsight document in MongoDB
      const savedInsight = await AIInsight.findById(body.data.insightId);
      expect(savedInsight).toBeDefined();
      expect(savedInsight!.targetType).toBe("deal");
      expect(savedInsight!.targetId!.toString()).toBe(deal._id.toString());
      expect(savedInsight!.priority).toBe("high");
      expect(savedInsight!.metadata?.riskScore).toBe(75);
      expect(savedInsight!.metadata?.healthScore).toBe(25);

      // 8. Verify prompt contents passed to AI model
      const history = mockDriver.getCallHistory();
      expect(history).toHaveLength(1);
      const call = history[0];
      expect(call.prompt).toContain(deal.name);
      expect(call.prompt).toContain("$120,000");
      expect(call.prompt).toContain("Workday is offering a 3-year bundle");
      expect(call.prompt).toContain("Address Pricing Objections");
    });
  });

  describe("3. Caching & Cache Invalidation", () => {
    it("should return cached risk analysis on subsequent requests and re-compute when forceRefresh is true", async () => {
      const deal = await Deal.create({
        name: `Cached Deal ${testPrefix}`,
        organizationId: testOrg._id,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 50000,
        currency: "USD",
      });
      createdDealIds.push(deal._id);

      const mockResult1 = {
        riskLevel: "medium" as const,
        riskScore: 40,
        healthScore: 60,
        detectedObjections: ["Budget timeline"],
        competitorMentions: [],
        recommendedAction: "Follow up next week",
        rescuePlaybook: "Standard proposal review",
        confidenceScore: 0.85,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockResult1);

      // Initial analysis
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = res1.json();
      expect(body1.data.cached).toBe(false);
      expect(body1.data.healthScore).toBe(60);
      createdInsightIds.push(new mongoose.Types.ObjectId(body1.data.insightId));
      expect(mockDriver.getCallHistory()).toHaveLength(1);

      // Subsequent call -> cached
      const res2 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = res2.json();
      expect(body2.data.cached).toBe(true);
      expect(body2.data.insightId).toBe(body1.data.insightId);
      // AI model should NOT have been invoked again
      expect(mockDriver.getCallHistory()).toHaveLength(1);

      // Force refresh call -> re-invokes model
      const mockResult2 = {
        riskLevel: "critical" as const,
        riskScore: 90,
        healthScore: 10,
        detectedObjections: ["Immediate freeze on external software spending"],
        competitorMentions: [],
        recommendedAction: "Escalate to CRO immediately",
        rescuePlaybook: "Executive emergency intervention",
        confidenceScore: 0.98,
      };
      mockDriver.enqueueResponse(mockResult2);

      const res3 = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { forceRefresh: true },
      });
      expect(res3.statusCode).toBe(200);
      const body3 = res3.json();
      expect(body3.data.cached).toBe(false);
      expect(body3.data.riskLevel).toBe("critical");
      expect(body3.data.healthScore).toBe(10);
      createdInsightIds.push(new mongoose.Types.ObjectId(body3.data.insightId));
      expect(mockDriver.getCallHistory()).toHaveLength(2);

      // Verify deal updated with critical health score
      const recheckedDeal = await Deal.findById(deal._id);
      expect(recheckedDeal!.healthScore).toBe(10);
    });
  });

  describe("4. Graceful Fallback When AI Provider is Unconfigured", () => {
    it("should return HTTP 400 with AI_NOT_CONFIGURED instead of 500 when provider missing", async () => {
      const deal = await Deal.create({
        name: `Unconfigured Deal ${testPrefix}`,
        organizationId: testOrg._id,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "lead",
        value: 10000,
        currency: "USD",
      });
      createdDealIds.push(deal._id);

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.setSimulatedError(
        new ProviderNotConfiguredError(
          "openai",
          "No AI API key is configured. Please navigate to Sales Integrations to configure OpenAI or Google Gemini."
        )
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
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

  describe("5. Historical Deal Insights Listing", () => {
    it("should list all insights generated for a specific deal", async () => {
      const deal = await Deal.create({
        name: `History Deal ${testPrefix}`,
        organizationId: testOrg._id,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 75000,
        currency: "USD",
      });
      createdDealIds.push(deal._id);

      const mockResult = {
        riskLevel: "low" as const,
        riskScore: 20,
        healthScore: 80,
        detectedObjections: [],
        competitorMentions: [],
        recommendedAction: "Send contract for signature",
        rescuePlaybook: "Standard closing sequence",
        confidenceScore: 0.9,
      };

      const mockDriver = AIClientFactory.getMockDriver();
      mockDriver.enqueueResponse(mockResult);

      const analyzeRes = await app.inject({
        method: "POST",
        url: `/api/v1/sales/ai/deals/${deal._id}/analyze-risk`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      const insightId = analyzeRes.json().data.insightId;
      createdInsightIds.push(new mongoose.Types.ObjectId(insightId));

      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/sales/ai/deals/${deal._id}/insights`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(listRes.statusCode).toBe(200);
      const listBody = listRes.json();
      expect(listBody.success).toBe(true);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0]._id).toBe(insightId);
      expect(listBody.data[0].targetType).toBe("deal");
      expect(listBody.data[0].targetId).toBe(deal._id.toString());
      expect(listBody.data[0].insightType).toBe("deal_risk");
    });
  });
});
