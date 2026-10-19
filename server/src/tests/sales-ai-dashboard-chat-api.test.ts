import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import Deal from "../modules/sales/models/deal.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import AIInsight from "../modules/sales/models/ai-insight.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { AIClientFactory } from "../modules/sales/ai/ai-client.factory.js";

describe("AI-004: AI Sales Overview & Natural Language Chat API", () => {
  let app: FastifyInstance;
  const testPrefix = `aichat-${Date.now()}`;
  let superAdminUser: any;
  let regularUser: any;
  let superAdminToken: string;
  let regularToken: string;
  let testOrg: any;
  let testPipeline: any;
  let testCompany: any;
  let testContact: any;

  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
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
      name: `AI Dashboard Org ${testPrefix}`,
      slug: `ai-dash-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ai-dash-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
      },
      roles: ["super_admin"],
      systemRole: "super_admin",
      status: "active",
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `regular-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "User",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "active",
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
      organizationId: testOrg._id,
      name: `AI Test Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "discovery", name: "Discovery", order: 1, probability: 0.2, rotDays: 14 },
        { key: "proposal", name: "Proposal", order: 2, probability: 0.5, rotDays: 10 },
        { key: "negotiation", name: "Negotiation", order: 3, probability: 0.8, rotDays: 7 },
      ],
    });

    testCompany = await Company.create({
      organizationId: testOrg._id,
      name: `Titan Tech ${testPrefix}`,
      domain: `titan-${testPrefix}.test`,
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      organizationId: testOrg._id,
      companyId: testCompany._id,
      firstName: "Tony",
      lastName: "Stark",
      fullName: "Tony Stark",
      email: `tony-${testPrefix}@stark.test`,
      normalizedEmail: `tony-${testPrefix}@stark.test`,
    });
    createdContactIds.push(testContact._id);
  });

  afterAll(async () => {
    delete process.env.SALES_AI_DRIVER;
    delete process.env.SALES_AI_FORCE_UNCONFIGURED;

    if (createdDealIds.length) await Deal.deleteMany({ _id: { $in: createdDealIds } });
    if (createdLeadIds.length) await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    if (createdInsightIds.length) await AIInsight.deleteMany({ _id: { $in: createdInsightIds } });
    if (createdContactIds.length) await Contact.deleteMany({ _id: { $in: createdContactIds } });
    if (createdCompanyIds.length) await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    if (testPipeline) await Pipeline.deleteOne({ _id: testPipeline._id });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    if (createdOrgIds.length) await Organization.deleteMany({ _id: { $in: createdOrgIds } });

    await app.close();
    await disconnectDatabase();
  });

  beforeEach(() => {
    delete process.env.SALES_AI_DRIVER;
    delete process.env.SALES_AI_FORCE_UNCONFIGURED;
    AIClientFactory.clearCache();
  });

  describe("1. RBAC & Security Boundaries", () => {
    it("should return 403 when GET /overview is called by non-super_admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/ai/overview",
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 when POST /chat is called by non-super_admin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/chat",
        headers: { authorization: `Bearer ${regularToken}` },
        payload: { message: "What deals are stuck?" },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("2. AI Overview Endpoint (GET /api/v1/sales/ai/overview)", () => {
    it("should return aggregated metrics, high-risk deals, and high-intent leads from live database", async () => {
      // Seed a high-risk deal
      const riskDeal = await Deal.create({
        organizationId: testOrg._id,
        name: `At-Risk Deal ${testPrefix}`,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "negotiation",
        value: 95000,
        currency: "USD",
        annualRecurringRevenue: 95000,
        oneTimeImplementationFee: 5000,
        probability: 0.8,
        healthScore: 32,
        riskFlags: ["Budget freeze", "Decision maker silent"],
        stageHistory: [
          {
            fromStage: "proposal",
            toStage: "negotiation",
            changedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
          },
        ],
      });
      createdDealIds.push(riskDeal._id);

      // Seed a high-intent lead
      const intentLead = await Lead.create({
        organizationId: testOrg._id,
        name: `High Intent Lead ${testPrefix}`,
        email: `intent-${testPrefix}@enterprise.test`,
        normalizedEmail: `intent-${testPrefix}@enterprise.test`,
        companyName: `Apex Enterprise ${testPrefix}`,
        source: "website",
        status: "qualified",
        score: 85,
        priority: "urgent",
      });
      createdLeadIds.push(intentLead._id);

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/ai/overview",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.configured).toBe(true);
      expect(json.data.stats.highRiskDealsCount).toBeGreaterThanOrEqual(1);
      expect(json.data.stats.atRiskPipelineValue).toBeGreaterThanOrEqual(95000);
      expect(json.data.stats.highIntentLeadsCount).toBeGreaterThanOrEqual(1);

      // Verify deal item structure
      const foundDeal = json.data.topRiskDeals.find((d: any) => d._id === riskDeal._id.toString());
      expect(foundDeal).toBeDefined();
      expect(foundDeal.healthScore).toBe(32);
      expect(foundDeal.riskFlags).toContain("Budget freeze");
      expect(foundDeal.latestInsight?.rescuePlaybook).toBeDefined();

      // Verify lead item structure
      const foundLead = json.data.topIntentLeads.find((l: any) => l._id === intentLead._id.toString());
      expect(foundLead).toBeDefined();
      expect(foundLead.score).toBe(85);
      expect(foundLead.intentBadge).toBe("Hot Intent");
      expect(foundLead.recommendedAction).toBeDefined();
    });

    it("should return configured: false and zero counters when simulateOffline query param is set", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/ai/overview?simulateOffline=true",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.configured).toBe(false);
      expect(json.data.provider).toBeNull();
      expect(json.data.stats.highRiskDealsCount).toBe(0);
      expect(json.data.stats.atRiskPipelineValue).toBe(0);
      expect(json.data.topRiskDeals).toEqual([]);
      expect(json.data.topIntentLeads).toEqual([]);
    });
  });

  describe("3. Conversational Sales Data Co-Pilot (POST /api/v1/sales/ai/chat)", () => {
    it("should return 400 when message payload is invalid or empty", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/chat",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { message: "" },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe("VALIDATION_ERROR");
    });

    it("should answer natural language questions grounded in live CRM database metrics", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/chat",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          message: "Which deals haven't progressed this month?",
          history: [],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.reply).toBeDefined();
      expect(typeof json.data.reply).toBe("string");
      expect(json.data.contextualMetrics).toBeDefined();
      expect(json.data.contextualMetrics.openDealsCount).toBeGreaterThanOrEqual(1);
    });

    it("should return 400 AI_NOT_CONFIGURED when AI provider credentials are explicitly unconfigured", async () => {
      process.env.SALES_AI_FORCE_UNCONFIGURED = "true";

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/ai/chat",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { message: "What is our pipeline risk?" },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("AI_NOT_CONFIGURED");
      expect(json.configured).toBe(false);
    });
  });
});
