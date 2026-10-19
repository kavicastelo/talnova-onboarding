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
import SalesTask from "../modules/sales/models/task.model.js";
import Campaign from "../modules/sales/models/campaign.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("ANL-001: Sales Overview Metrics & Action Center Aggregations API", () => {
  let app: FastifyInstance;
  const testPrefix = `anl001-${Date.now()}`;
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
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdCampaignIds: mongoose.Types.ObjectId[] = [];
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
      name: `Analytics Test Org ${testPrefix}`,
      slug: `anl-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `anl-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Analytics",
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
        email: `anl-regular-${testPrefix}@talnova.test`,
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
      name: `Overview Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "discovery", name: "Discovery", order: 1, probability: 0.2, rotDays: 14 },
        { key: "proposal", name: "Proposal", order: 2, probability: 0.5, rotDays: 10 },
        { key: "negotiation", name: "Negotiation", order: 3, probability: 0.8, rotDays: 7 },
      ],
    });

    testCompany = await Company.create({
      organizationId: testOrg._id,
      name: `Vertex Global ${testPrefix}`,
      domain: `vertex-${testPrefix}.test`,
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      organizationId: testOrg._id,
      companyId: testCompany._id,
      firstName: "Alexander",
      lastName: "Pierce",
      fullName: "Alexander Pierce",
      email: `alex-${testPrefix}@vertex.test`,
      normalizedEmail: `alex-${testPrefix}@vertex.test`,
    });
    createdContactIds.push(testContact._id);
  });

  afterAll(async () => {
    if (createdDealIds.length) await Deal.deleteMany({ _id: { $in: createdDealIds } });
    if (createdLeadIds.length) await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    if (createdTaskIds.length) await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    if (createdCampaignIds.length) await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    if (createdContactIds.length) await Contact.deleteMany({ _id: { $in: createdContactIds } });
    if (createdCompanyIds.length) await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    if (testPipeline) await Pipeline.deleteOne({ _id: testPipeline._id });
    if (createdUserIds.length) await User.deleteMany({ _id: { $in: createdUserIds } });
    if (createdOrgIds.length) await Organization.deleteMany({ _id: { $in: createdOrgIds } });

    await app.close();
    await disconnectDatabase();
  });

  describe("1. RBAC & Security Boundaries", () => {
    it("should return 401 when GET /overview is called without token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/analytics/overview",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when GET /overview is called by non-super_admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/analytics/overview",
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 403 when GET /action-center is called by non-super_admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/analytics/action-center",
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("2. Single-Source-of-Truth Metrics Calculations with Known Test Fixtures", () => {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const currentEnd = now;
    const priorStart = new Date(currentStart.getTime() - 10 * 24 * 60 * 60 * 1000); // 20 days ago
    const priorEnd = currentStart;

    beforeAll(async () => {
      // 1. Current Period Leads: 4 leads (2 qualified, 1 contacted, 1 new)
      const lead1 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Cur 1 ${testPrefix}`,
        email: `cur1-${testPrefix}@test.com`,
        normalizedEmail: `cur1-${testPrefix}@test.com`,
        companyName: "Acme 1",
        source: "website",
        status: "qualified",
        score: 85,
        createdAt: new Date(currentStart.getTime() + 2 * 24 * 60 * 60 * 1000),
      });
      const lead2 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Cur 2 ${testPrefix}`,
        email: `cur2-${testPrefix}@test.com`,
        normalizedEmail: `cur2-${testPrefix}@test.com`,
        companyName: "Acme 2",
        source: "referral",
        status: "opportunity",
        score: 90,
        createdAt: new Date(currentStart.getTime() + 4 * 24 * 60 * 60 * 1000),
      });
      const lead3 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Cur 3 ${testPrefix}`,
        email: `cur3-${testPrefix}@test.com`,
        normalizedEmail: `cur3-${testPrefix}@test.com`,
        companyName: "Acme 3",
        source: "campaign",
        status: "contacted",
        score: 60,
        createdAt: new Date(currentStart.getTime() + 5 * 24 * 60 * 60 * 1000),
      });
      const lead4 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Cur 4 ${testPrefix}`,
        email: `cur4-${testPrefix}@test.com`,
        normalizedEmail: `cur4-${testPrefix}@test.com`,
        companyName: "Acme 4",
        source: "product_demo",
        status: "new",
        score: 45,
        createdAt: new Date(currentStart.getTime() + 6 * 24 * 60 * 60 * 1000),
      });
      createdLeadIds.push(lead1._id, lead2._id, lead3._id, lead4._id);

      // Prior Period Leads: 2 leads (1 qualified)
      const priorLead1 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Prior 1 ${testPrefix}`,
        email: `prior1-${testPrefix}@test.com`,
        normalizedEmail: `prior1-${testPrefix}@test.com`,
        companyName: "Prior 1",
        source: "website",
        status: "qualified",
        score: 80,
        createdAt: new Date(priorStart.getTime() + 2 * 24 * 60 * 60 * 1000),
      });
      const priorLead2 = await Lead.create({
        organizationId: testOrg._id,
        name: `Lead Prior 2 ${testPrefix}`,
        email: `prior2-${testPrefix}@test.com`,
        normalizedEmail: `prior2-${testPrefix}@test.com`,
        companyName: "Prior 2",
        source: "website",
        status: "new",
        score: 30,
        createdAt: new Date(priorStart.getTime() + 4 * 24 * 60 * 60 * 1000),
      });
      createdLeadIds.push(priorLead1._id, priorLead2._id);

      // 2. Open Deals
      const openDeal1 = await Deal.create({
        organizationId: testOrg._id,
        name: `Open Deal Discovery ${testPrefix}`,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "discovery",
        value: 100000,
        currency: "USD",
        probability: 0.2, // $20,000 weighted
        createdAt: new Date(currentStart.getTime() + 1 * 24 * 60 * 60 * 1000),
      });
      const openDeal2 = await Deal.create({
        organizationId: testOrg._id,
        name: `Open Deal Proposal ${testPrefix}`,
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 200000,
        currency: "USD",
        probability: 0.5, // $100,000 weighted
        createdAt: new Date(currentStart.getTime() + 3 * 24 * 60 * 60 * 1000),
      });
      createdDealIds.push(openDeal1._id, openDeal2._id);

      // 3. Won & Lost Deals
      const wonDeal = await Deal.create({
        organizationId: testOrg._id,
        name: `Won Deal Cur ${testPrefix}`,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "closed_won",
        value: 50000,
        currency: "USD",
        probability: 1.0,
        actualCloseDate: new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(currentStart.getTime() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000),
      });
      const lostDeal = await Deal.create({
        organizationId: testOrg._id,
        name: `Lost Deal Cur ${testPrefix}`,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "closed_lost",
        value: 25000,
        currency: "USD",
        probability: 0,
        createdAt: new Date(currentStart.getTime() + 2 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(currentStart.getTime() + 5 * 24 * 60 * 60 * 1000),
      });
      createdDealIds.push(wonDeal._id, lostDeal._id);
    });

    it("should compute exact lead metrics, qualification rate, and period deltas", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/overview?startDate=${currentStart.toISOString()}&endDate=${currentEnd.toISOString()}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const { leads } = json.data;
      expect(leads.totalLeads).toBeGreaterThanOrEqual(6);
      expect(leads.periodNewLeads.current).toBe(4);
      expect(leads.periodNewLeads.prior).toBe(2);
      expect(leads.periodNewLeads.delta).toBe(2);
      expect(leads.periodNewLeads.percentageChange).toBe(100.0);

      // Qualified count: 2 in current, 1 in prior
      expect(leads.qualifiedLeads.current).toBe(2);
      expect(leads.qualifiedLeads.prior).toBe(1);

      // Qualification rate: (2/4)*100 = 50.0% current vs (1/2)*100 = 50.0% prior
      expect(leads.qualificationRate.current).toBe(50.0);
      expect(leads.qualificationRate.prior).toBe(50.0);
      expect(leads.qualificationRate.delta).toBe(0);
    });

    it("should compute exact pipeline values, weighted sum, and win rates", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/overview?startDate=${currentStart.toISOString()}&endDate=${currentEnd.toISOString()}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const { deals, stageBreakdown } = json.data;

      // Open pipeline: $100k + $200k = $300,000
      expect(deals.openPipelineValue.current).toBe(300000);
      // Weighted value: (100k * 0.2) + (200k * 0.5) = 20k + 100k = $120,000
      expect(deals.weightedPipelineValue.current).toBe(120000);

      // Closed won revenue in period: $50,000
      expect(deals.closedWonRevenue.current).toBe(50000);

      // Win rate: 1 won, 1 lost -> 50.0%
      expect(deals.dealsWonCount.current).toBe(1);
      expect(deals.dealsLostCount.current).toBe(1);
      expect(deals.winRate.current).toBe(50.0);

      // Stage breakdown check
      expect(Array.isArray(stageBreakdown)).toBe(true);
      const discoveryStage = stageBreakdown.find((s: any) => s.stageKey === "discovery");
      expect(discoveryStage).toBeDefined();
      expect(discoveryStage.totalValue).toBe(100000);
      expect(discoveryStage.weightedValue).toBe(20000);

      const proposalStage = stageBreakdown.find((s: any) => s.stageKey === "proposal");
      expect(proposalStage).toBeDefined();
      expect(proposalStage.totalValue).toBe(200000);
      expect(proposalStage.weightedValue).toBe(100000);
    });
  });

  describe("3. Action Center Aggregations (GET /api/v1/sales/analytics/action-center)", () => {
    beforeAll(async () => {
      const now = new Date();

      // 1. Stale lead (> 48h inactive)
      const staleLead = await Lead.create({
        organizationId: testOrg._id,
        name: `Stale Action Lead ${testPrefix}`,
        email: `stale-${testPrefix}@action.test`,
        normalizedEmail: `stale-${testPrefix}@action.test`,
        companyName: "Action Corp",
        source: "website",
        status: "new",
        score: 82,
        createdAt: new Date(now.getTime() - 72 * 60 * 60 * 1000), // 72 hours ago
      });
      createdLeadIds.push(staleLead._id);

      // 2. Overdue task
      const overdueTask = await SalesTask.create({
        title: `Overdue Contract Review ${testPrefix}`,
        type: "proposal",
        status: "pending",
        priority: "urgent",
        dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days overdue
      });
      createdTaskIds.push(overdueTask._id);

      // 3. Stalled deal closing soon (< 7 days close, > 3 days inactive)
      const closingDeal = await Deal.create({
        organizationId: testOrg._id,
        name: `Closing Soon Deal ${testPrefix}`,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 85000,
        currency: "USD",
        probability: 0.5,
        expectedCloseDate: new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        updatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days inactive
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      });
      createdDealIds.push(closingDeal._id);

      // 4. Failed campaign
      const failedCamp = await Campaign.create({
        name: `Q4 Enterprise Push ${testPrefix}`,
        channel: "email",
        status: "failed",
        createdBy: superAdminUser._id,
        stats: {
          totalRecipients: 100,
          sentCount: 12,
          deliveredCount: 0,
          openedCount: 0,
          clickedCount: 0,
          bouncedCount: 0,
          repliedCount: 0,
          failedCount: 88,
        },
        recipients: [],
      });
      createdCampaignIds.push(failedCamp._id);
    });

    it("should return prioritized Action Center items across all 4 operational risk categories", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/analytics/action-center",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const { data } = json;
      expect(data.totalActionableCount).toBeGreaterThanOrEqual(4);
      expect(data.categoryCounts.staleLeads).toBeGreaterThanOrEqual(1);
      expect(data.categoryCounts.overdueTasks).toBeGreaterThanOrEqual(1);
      expect(data.categoryCounts.closingSoonDeals).toBeGreaterThanOrEqual(1);
      expect(data.categoryCounts.failedCampaigns).toBeGreaterThanOrEqual(1);

      // Verify specific items are identified
      const staleItem = data.items.find((i: any) => i.category === "stale_lead");
      expect(staleItem).toBeDefined();
      expect(staleItem.priority).toBe("urgent");
      expect(staleItem.actionUrl).toContain("/super-admin/sales/leads");

      const taskItem = data.items.find((i: any) => i.category === "overdue_task");
      expect(taskItem).toBeDefined();
      expect(taskItem.title).toContain("Overdue Contract Review");

      const dealItem = data.items.find((i: any) => i.category === "closing_soon_deal");
      expect(dealItem).toBeDefined();
      expect(dealItem.title).toContain("Closing Soon Deal");

      const campItem = data.items.find((i: any) => i.category === "failed_campaign");
      expect(campItem).toBeDefined();
      expect(campItem.title).toContain("Q4 Enterprise Push");
    });
  });
});
