import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("CRM-002: Deals Management API & Weighted Pipeline Engine", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testCompany: any;
  let testContact: any;
  let defaultPipeline: any;

  const testPrefix = `deal-test-${Date.now()}`;
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Deal Test Org ${testPrefix}`,
      slug: `deal-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `deal-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Deal",
        lastName: "Admin",
        fullName: "Deal Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        customRoles: [],
      },
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `deal-employee-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Sales",
        fullName: "Regular Sales",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "employee",
        customRoles: [],
      },
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    regularToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      email: regularUser.auth.email,
      role: regularUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // Create a base test company
    testCompany = await Company.create({
      name: `Acme Corp ${testPrefix}`,
      domain: `acme-${testPrefix}.test`,
      industry: "Technology",
      tier: "enterprise",
      status: "qualified",
    });
    createdCompanyIds.push(testCompany._id);

    // Create a base test contact
    testContact = await Contact.create({
      companyId: testCompany._id,
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: `jane-${testPrefix}@acme.test`,
      normalizedEmail: `jane-${testPrefix}@acme.test`.toLowerCase(),
      isPrimaryDecisionMaker: true,
    });
    createdContactIds.push(testContact._id);

    // Ensure default pipeline is seeded
    const pipeRes = await app.inject({
      method: "GET",
      url: "/api/v1/sales/pipelines/default",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    const pipeBody = JSON.parse(pipeRes.body);
    defaultPipeline = pipeBody.data;
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
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
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Route Protection & RBAC Guard", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject non-super_admin role with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow super_admin access to list deals", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("2. Deal Creation & Default Attributes", () => {
    it("should reject creation when associated company does not exist", async () => {
      const nonExistentCompanyId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          name: "Invalid Deal",
          companyId: nonExistentCompanyId.toString(),
          value: 10000,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("COMPANY_NOT_FOUND");
    });

    it("should create a deal with default pipeline, initial stage, and log AuditLog", async () => {
      const payload = {
        name: `Enterprise Cloud Migration ${testPrefix}`,
        companyId: testCompany._id.toString(),
        primaryContactId: testContact._id.toString(),
        value: 100000,
        currency: "USD",
        annualRecurringRevenue: 80000,
        oneTimeImplementationFee: 20000,
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        notes: "Key strategic account",
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(payload.name);
      expect(body.data.companyId).toBe(payload.companyId);
      expect(body.data.stage).toBe("qualification");
      expect(body.data.probability).toBe(0.1);
      expect(body.data.stageHistory).toBeDefined();
      expect(body.data.stageHistory.length).toBe(1);
      expect(body.data.stageHistory[0].fromStage).toBe("created");
      expect(body.data.stageHistory[0].toStage).toBe("qualification");

      createdDealIds.push(new mongoose.Types.ObjectId(body.data._id));

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(body.data._id),
        eventType: "DEAL_CREATED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe("create");
      expect(auditLog!.resourceType).toBe("sales_deal");
    });
  });

  describe("3. Weighted Value Calculations & Pipeline Summary Across Currencies", () => {
    let dealUSD: any;
    let dealEUR: any;

    beforeAll(async () => {
      // Create USD Deal: 100,000 at 0.50 (demo_completed) -> weighted: 50,000
      const resUSD = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `USD Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 100000,
          currency: "USD",
          stage: "demo_completed",
          probability: 0.5,
          expectedCloseDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      dealUSD = JSON.parse(resUSD.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(dealUSD._id));

      // Create EUR Deal: 50,000 at 0.70 (proposal_sent) -> weighted: 35,000
      const resEUR = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `EUR Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 50000,
          currency: "EUR",
          stage: "proposal_sent",
          probability: 0.7,
          expectedCloseDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      dealEUR = JSON.parse(resEUR.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(dealEUR._id));
    });

    it("should return correct weighted value on GET /api/v1/sales/deals/:id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/deals/${dealUSD._id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe(100000);
      expect(body.data.probability).toBe(0.5);
      expect(body.data.weightedValue).toBe(50000);
    });

    it("should aggregate weighted values correctly on GET /api/v1/sales/deals/summary", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals/summary",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const summary = body.data;
      expect(summary.totalDeals).toBeGreaterThanOrEqual(2);
      expect(summary.totalValue).toBeGreaterThanOrEqual(150000);
      expect(summary.weightedValue).toBeGreaterThanOrEqual(85000);

      // Verify currency breakdown contains USD and EUR
      const usdItem = summary.currencyBreakdown.find((c: any) => c.currency === "USD");
      const eurItem = summary.currencyBreakdown.find((c: any) => c.currency === "EUR");

      expect(usdItem).toBeDefined();
      expect(usdItem.totalValue).toBeGreaterThanOrEqual(100000);
      expect(usdItem.weightedValue).toBeGreaterThanOrEqual(50000);

      expect(eurItem).toBeDefined();
      expect(eurItem.totalValue).toBeGreaterThanOrEqual(50000);
      expect(eurItem.weightedValue).toBeGreaterThanOrEqual(35000);

      // Verify stage breakdown includes demo_completed and proposal_sent
      const demoStage = summary.stageBreakdown.find((s: any) => s.stage === "demo_completed");
      const proposalStage = summary.stageBreakdown.find((s: any) => s.stage === "proposal_sent");

      expect(demoStage).toBeDefined();
      expect(demoStage.count).toBeGreaterThanOrEqual(1);
      expect(proposalStage).toBeDefined();
      expect(proposalStage.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Stage Transitions, Required Fields & History Tracking", () => {
    let testDeal: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Transition Test Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 60000,
          currency: "USD",
          expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        },
      });
      testDeal = JSON.parse(res.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(testDeal._id));
    });

    it("should advance stage from qualification to discovery_completed and update probability", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${testDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "discovery_completed",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.stage).toBe("discovery_completed");
      expect(body.data.probability).toBe(0.25); // Default probability for discovery_completed

      // Verify stage history tracking
      expect(body.data.stageHistory.length).toBe(2);
      const latestHistory = body.data.stageHistory[1];
      expect(latestHistory.fromStage).toBe("qualification");
      expect(latestHistory.toStage).toBe("discovery_completed");
      expect(latestHistory.changedBy).toBeDefined();
    });

    it("should reject transition if stage required fields are missing", async () => {
      // Create a deal in qualification that has value & primaryContactId, but lacks expectedCloseDate
      const incompleteRes = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Incomplete Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 50000,
        },
      });
      expect(incompleteRes.statusCode).toBe(201);
      const incompleteDeal = JSON.parse(incompleteRes.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(incompleteDeal._id));

      // Attempt to move to discovery_completed which requires value, primaryContactId, expectedCloseDate
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${incompleteDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "discovery_completed",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("STAGE_REQUIREMENTS_NOT_MET");
    });
  });

  describe("5. Closed-Lost Enforcement & Loss Reason Capture", () => {
    let lossDeal: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Loss Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 40000,
          currency: "USD",
        },
      });
      lossDeal = JSON.parse(res.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(lossDeal._id));
    });

    it("should reject transition to closed_lost without a documented lossReason", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${lossDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "closed_lost",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("MISSING_LOSS_REASON");
    });

    it("should transition to closed_lost when lossReason is provided", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${lossDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "closed_lost",
          lossReason: "Budget cuts",
          lossDetails: "Customer froze enterprise hiring and cloud migration projects for Q4.",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.stage).toBe("closed_lost");
      expect(body.data.probability).toBe(0.0);
      expect(body.data.lossReason).toBe("Budget cuts");
      expect(body.data.lossDetails).toContain("Customer froze");
      expect(body.data.actualCloseDate).toBeDefined();
    });
  });

  describe("6. Closed-Won & Won Details Tracking", () => {
    let wonDeal: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Won Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 150000,
          currency: "USD",
          expectedCloseDate: new Date().toISOString(),
        },
      });
      wonDeal = JSON.parse(res.body).data;
      createdDealIds.push(new mongoose.Types.ObjectId(wonDeal._id));
    });

    it("should transition to closed_won, set probability 1.0, and record wonDetails", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/deals/${wonDeal._id}/stage`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          stage: "closed_won",
          wonDetails: {
            contractSignedDate: new Date().toISOString(),
            approvedBy: superAdminUser._id.toString(),
            organizationId: testOrg._id.toString(),
            onboardingHandedOff: false,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.stage).toBe("closed_won");
      expect(body.data.probability).toBe(1.0);
      expect(body.data.actualCloseDate).toBeDefined();
      expect(body.data.wonDetails).toBeDefined();
      expect(body.data.wonDetails.onboardingHandedOff).toBe(false);
    });
  });

  describe("7. Interactive Kanban Board Aggregations", () => {
    it("should return Kanban board grouped by pipeline stages with calculated weighted metrics", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals/kanban",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const kanban = body.data;
      expect(kanban.pipeline).toBeDefined();
      expect(Array.isArray(kanban.stages)).toBe(true);
      expect(kanban.stages.length).toBeGreaterThanOrEqual(7);

      // Verify each stage contains dealCount, totalValue, weightedValue, deals array
      for (const st of kanban.stages) {
        expect(st.key).toBeDefined();
        expect(st.name).toBeDefined();
        expect(typeof st.dealCount).toBe("number");
        expect(typeof st.totalValue).toBe("number");
        expect(typeof st.weightedValue).toBe("number");
        expect(Array.isArray(st.deals)).toBe(true);
      }

      // Check global board totals
      expect(kanban.totals.dealCount).toBeGreaterThan(0);
      expect(kanban.totals.totalValue).toBeGreaterThan(0);
      expect(kanban.totals.weightedValue).toBeGreaterThan(0);
    });
  });

  describe("8. Deal Deletion & Audit Logging", () => {
    let disposableDeal: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Disposable Deal ${testPrefix}`,
          companyId: testCompany._id.toString(),
          primaryContactId: testContact._id.toString(),
          value: 12000,
        },
      });
      expect(res.statusCode).toBe(201);
      disposableDeal = JSON.parse(res.body).data;
    });

    it("should delete the deal and log an AuditLog entry", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/deals/${disposableDeal._id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const check = await Deal.findById(disposableDeal._id);
      expect(check).toBeNull();

      const audit = await AuditLog.findOne({
        resourceId: disposableDeal._id,
        eventType: "DEAL_DELETED",
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe("delete");
    });
  });
});
