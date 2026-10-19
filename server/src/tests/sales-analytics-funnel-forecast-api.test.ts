import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import Deal from "../modules/sales/models/deal.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("ANL-002: Conversion Funnel & Revenue Forecasting API", () => {
  let app: FastifyInstance;
  const testPrefix = `anl002-${Date.now()}`;
  let superAdminUser: any;
  let regularUser: any;
  let salesRep1: any;
  let salesRep2: any;
  let superAdminToken: string;
  let regularToken: string;
  let testOrg: any;
  let testPipeline: any;
  let testCompany: any;
  let testContact: any;

  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdPipelineIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase();
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    testOrg = await Organization.create({
      name: `Analytics 002 Org ${testPrefix}`,
      slug: `anl002-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `anl002-admin-${testPrefix}@talnova.test`,
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
        email: `anl002-regular-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Employee",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "active",
    });
    createdUserIds.push(regularUser._id);

    salesRep1 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `anl002-rep1-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Jane",
        lastName: "Doe",
      },
      roles: ["sales_rep"],
      systemRole: "employee",
      status: "active",
    });
    createdUserIds.push(salesRep1._id);

    salesRep2 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `anl002-rep2-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "John",
        lastName: "Smith",
      },
      roles: ["sales_rep"],
      systemRole: "employee",
      status: "active",
    });
    createdUserIds.push(salesRep2._id);

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
      name: `Funnel Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "lead", name: "Lead", order: 1, probability: 0.1 },
        { key: "qualified", name: "Qualified", order: 2, probability: 0.3 },
        { key: "proposal", name: "Proposal", order: 3, probability: 0.5 },
        { key: "negotiation", name: "Negotiation", order: 4, probability: 0.8 },
        { key: "closed_won", name: "Closed Won", order: 5, probability: 1.0 },
        { key: "closed_lost", name: "Closed Lost", order: 6, probability: 0.0 },
      ],
    });
    createdPipelineIds.push(testPipeline._id);

    testCompany = await Company.create({
      organizationId: testOrg._id,
      name: `Funnel Enterprise ${testPrefix}`,
      domain: `${testPrefix}.example.com`,
      industry: "Software",
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      organizationId: testOrg._id,
      companyId: testCompany._id,
      firstName: "Funnel",
      lastName: "Contact",
      fullName: "Funnel Contact",
      email: `funnel.contact-${testPrefix}@example.com`,
      normalizedEmail: `funnel.contact-${testPrefix}@example.com`,
    });
    createdContactIds.push(testContact._id);
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdPipelineIds.length > 0) {
      await Pipeline.deleteMany({ _id: { $in: createdPipelineIds } });
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

  describe("Security & RBAC Enforcement", () => {
    it("should reject unauthenticated requests with 401 across all ANL-002 endpoints", async () => {
      const endpoints = [
        "/api/v1/sales/analytics/funnel",
        "/api/v1/sales/analytics/forecast",
        "/api/v1/sales/analytics/rep-performance",
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: "GET",
          url: endpoint,
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it("should forbid non-super_admin users with 403 across all ANL-002 endpoints", async () => {
      const endpoints = [
        "/api/v1/sales/analytics/funnel",
        "/api/v1/sales/analytics/forecast",
        "/api/v1/sales/analytics/rep-performance",
      ];

      for (const endpoint of endpoints) {
        const response = await app.inject({
          method: "GET",
          url: endpoint,
          headers: {
            authorization: `Bearer ${regularToken}`,
          },
        });

        expect(response.statusCode).toBe(403);
      }
    });
  });

  describe("Zero Mock Data Verification", () => {
    it("should return clean 0s and empty arrays when querying a distant future window with no records", async () => {
      const futureStart = new Date("2035-01-01T00:00:00.000Z").toISOString();
      const futureEnd = new Date("2035-01-31T23:59:59.999Z").toISOString();

      // Funnel with zero records
      const funnelRes = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/funnel?startDate=${futureStart}&endDate=${futureEnd}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(funnelRes.statusCode).toBe(200);
      const funnelData = JSON.parse(funnelRes.body).data;
      expect(funnelData.overallConversionRate).toBe(0);
      expect(funnelData.averageSalesCycleDays).toBe(0);
      expect(funnelData.stages).toHaveLength(5);
      for (const stage of funnelData.stages) {
        expect(stage.count).toBe(0);
        expect(stage.value).toBe(0);
        expect(stage.conversionRateFromTop).toBe(0);
      }

      // Forecast with zero records
      const forecastRes = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/forecast?period=month&startDate=${futureStart}&endDate=${futureEnd}&quotaTarget=50000`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(forecastRes.statusCode).toBe(200);
      const forecastData = JSON.parse(forecastRes.body).data;
      expect(forecastData.scenarios.closedWonActual).toBe(0);
      expect(forecastData.scenarios.committed).toBe(0);
      expect(forecastData.scenarios.weightedExpected).toBe(0);
      expect(forecastData.scenarios.bestCase).toBe(0);
      expect(forecastData.scenarios.openPipelineTotal).toBe(0);
      expect(forecastData.scenarios.dealsClosingInPeriodCount).toBe(0);
      expect(forecastData.projectedQuotaAttainment).toBe(0);
      expect(forecastData.pipelineCoverageRatio).toBe(0);
    });
  });

  describe("Multi-Stage Conversion Funnel Calculations", () => {
    it("should compute exact stage conversion rates, drop-off rates, and average cycle length", async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(now.getTime() + 1000);

      // Seed 4 leads
      const lead1 = await Lead.create({
        organizationId: testOrg._id,
        name: "Lead 1",
        email: `lead1-${testPrefix}@example.com`,
        normalizedEmail: `lead1-${testPrefix}@example.com`,
        companyName: "Acme",
        source: "website",
        status: "new",
        createdAt: new Date(windowStart.getTime() + 1000),
      });
      const lead2 = await Lead.create({
        organizationId: testOrg._id,
        name: "Lead 2",
        email: `lead2-${testPrefix}@example.com`,
        normalizedEmail: `lead2-${testPrefix}@example.com`,
        companyName: "Beta Corp",
        source: "website",
        status: "new",
        createdAt: new Date(windowStart.getTime() + 2000),
      });
      const lead3 = await Lead.create({
        organizationId: testOrg._id,
        name: "Lead 3",
        email: `lead3-${testPrefix}@example.com`,
        normalizedEmail: `lead3-${testPrefix}@example.com`,
        companyName: "Gamma Inc",
        source: "website",
        status: "qualified",
        createdAt: new Date(windowStart.getTime() + 3000),
      });
      const lead4 = await Lead.create({
        organizationId: testOrg._id,
        name: "Lead 4",
        email: `lead4-${testPrefix}@example.com`,
        normalizedEmail: `lead4-${testPrefix}@example.com`,
        companyName: "Delta LLC",
        source: "product_demo",
        status: "converted",
        createdAt: new Date(windowStart.getTime() + 4000),
      });
      createdLeadIds.push(lead1._id, lead2._id, lead3._id, lead4._id);

      // Seed 2 deals in this window
      // Deal A: proposal stage, $20,000
      const dealA = await Deal.create({
        organizationId: testOrg._id,
        name: "Proposal Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 20000,
        currency: "USD",
        annualRecurringRevenue: 20000,
        oneTimeImplementationFee: 0,
        probability: 0.5,
        stageHistory: [
          { fromStage: "qualified", toStage: "proposal", changedAt: new Date(), daysInPreviousStage: 4 },
        ],
        createdAt: new Date(windowStart.getTime() + 5000),
      });

      // Deal B: closed won, $30,000, cycle length of 10 days
      const dealCreatedAt = new Date(windowStart.getTime() + 6000);
      const dealClosedAt = new Date(dealCreatedAt.getTime() + 10 * 24 * 60 * 60 * 1000);
      const dealB = await Deal.create({
        organizationId: testOrg._id,
        name: "Won Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        stage: "closed_won",
        value: 30000,
        currency: "USD",
        annualRecurringRevenue: 30000,
        oneTimeImplementationFee: 0,
        probability: 1.0,
        createdAt: dealCreatedAt,
        actualCloseDate: dealClosedAt,
        stageHistory: [
          { fromStage: "proposal", toStage: "closed_won", changedAt: dealClosedAt, daysInPreviousStage: 6 },
        ],
      });
      createdDealIds.push(dealA._id, dealB._id);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/funnel?startDate=${windowStart.toISOString()}&endDate=${windowEnd.toISOString()}&pipelineId=${testPipeline._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body).data;

      // 4 leads created
      expect(data.stages[0].stageKey).toBe("leads_created");
      expect(data.stages[0].count).toBe(4);
      expect(data.stages[0].conversionRateFromTop).toBe(100);

      // 2 leads qualified (lead3 and lead4)
      expect(data.stages[1].stageKey).toBe("leads_qualified");
      expect(data.stages[1].count).toBe(2);
      expect(data.stages[1].conversionRateFromTop).toBe(50);
      expect(data.stages[1].stageToStageConversionRate).toBe(50);
      expect(data.stages[1].dropOffRate).toBe(50);

      // 2 opportunities created
      expect(data.stages[2].stageKey).toBe("opportunity_deals");
      expect(data.stages[2].count).toBe(2);
      expect(data.stages[2].value).toBe(50000);

      // 2 proposals presented (proposal + closed_won)
      expect(data.stages[3].stageKey).toBe("proposals_presented");
      expect(data.stages[3].count).toBe(2);
      expect(data.stages[3].value).toBe(50000);

      // 1 closed won deal ($30,000)
      expect(data.stages[4].stageKey).toBe("closed_won");
      expect(data.stages[4].count).toBe(1);
      expect(data.stages[4].value).toBe(30000);
      expect(data.stages[4].conversionRateFromTop).toBe(25); // 1 / 4 * 100

      // Overall conversion = 1 won / 4 leads = 25.0%
      expect(data.overallConversionRate).toBe(25.0);

      // Average sales cycle days = 10.0 days
      expect(data.averageSalesCycleDays).toBe(10.0);
    });
  });

  describe("Revenue Forecasting Multi-Tier Scenarios", () => {
    it("should calculate Best Case, Weighted/Expected, Committed, and Closed Won Actual accurately", async () => {
      const forecastPipeline = await Pipeline.create({
        organizationId: testOrg._id,
        name: `Forecast Pipeline ${testPrefix}`,
        isDefault: false,
        stages: [
          { key: "lead", name: "Lead", order: 1, probability: 0.2 },
          { key: "proposal", name: "Proposal", order: 2, probability: 0.5 },
          { key: "negotiation", name: "Negotiation", order: 3, probability: 0.9 },
          { key: "closed_won", name: "Closed Won", order: 4, probability: 1.0 },
        ],
      });
      createdPipelineIds.push(forecastPipeline._id);

      const now = new Date();
      const forecastStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
      const forecastEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const midMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12, 0, 0, 0));

      // 1. Closed Won deal: $50,000 realized
      const wonDeal = await Deal.create({
        organizationId: testOrg._id,
        name: "Forecast Realized Won",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: forecastPipeline._id,
        stage: "closed_won",
        value: 50000,
        currency: "USD",
        annualRecurringRevenue: 50000,
        oneTimeImplementationFee: 0,
        probability: 1.0,
        actualCloseDate: midMonth,
      });

      // 2. Open Deal A (Committed): negotiation, $40,000, 0.9 probability
      const openDealA = await Deal.create({
        organizationId: testOrg._id,
        name: "Forecast Committed Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: forecastPipeline._id,
        stage: "negotiation",
        value: 40000,
        currency: "USD",
        annualRecurringRevenue: 40000,
        oneTimeImplementationFee: 0,
        probability: 0.9,
        expectedCloseDate: midMonth,
      });

      // 3. Open Deal B (Weighted only): proposal, $30,000, 0.5 probability
      const openDealB = await Deal.create({
        organizationId: testOrg._id,
        name: "Forecast Proposal Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: forecastPipeline._id,
        stage: "proposal",
        value: 30000,
        currency: "USD",
        annualRecurringRevenue: 30000,
        oneTimeImplementationFee: 0,
        probability: 0.5,
        expectedCloseDate: midMonth,
      });

      // 4. Open Deal C (Weighted only): discovery/lead, $20,000, 0.2 probability
      const openDealC = await Deal.create({
        organizationId: testOrg._id,
        name: "Forecast Early Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: forecastPipeline._id,
        stage: "lead",
        value: 20000,
        currency: "USD",
        annualRecurringRevenue: 20000,
        oneTimeImplementationFee: 0,
        probability: 0.2,
        expectedCloseDate: midMonth,
      });

      createdDealIds.push(wonDeal._id, openDealA._id, openDealB._id, openDealC._id);

      const quotaTarget = 150000;
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/forecast?period=month&startDate=${forecastStart.toISOString()}&endDate=${forecastEnd.toISOString()}&quotaTarget=${quotaTarget}&pipelineId=${forecastPipeline._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body).data;

      // Closed Won Actual = $50,000
      expect(data.scenarios.closedWonActual).toBe(50000);

      // Open pipeline unweighted = 40000 + 30000 + 20000 = $90,000
      expect(data.scenarios.openPipelineTotal).toBe(90000);
      expect(data.scenarios.bestCase).toBe(90000);

      // Committed = Deal A (negotiation / 0.9 prob) = $40,000
      expect(data.scenarios.committed).toBe(40000);

      // Weighted / Expected = (40000 * 0.9) + (30000 * 0.5) + (20000 * 0.2)
      // = 36000 + 15000 + 4000 = 55,000
      expect(data.scenarios.weightedExpected).toBe(55000);

      // Quota attainment: (closedWonActual + weightedExpected) / quotaTarget * 100
      // = (50000 + 55000) / 150000 * 100 = 105000 / 150000 * 100 = 70.0%
      expect(data.projectedQuotaAttainment).toBe(70.0);

      // Pipeline coverage ratio: openPipelineTotal / quotaTarget = 90000 / 150000 = 0.60
      expect(data.pipelineCoverageRatio).toBe(0.6);

      // Monthly breakdown should contain this month's data point
      expect(data.monthlyBreakdown).toHaveLength(1);
      expect(data.monthlyBreakdown[0].closedWon).toBe(50000);
      expect(data.monthlyBreakdown[0].committed).toBe(40000);
      expect(data.monthlyBreakdown[0].weightedExpected).toBe(55000);
      expect(data.monthlyBreakdown[0].bestCase).toBe(90000);
    });
  });

  describe("Sales Rep Leaderboard & Performance Attribution", () => {
    it("should attribute closed deals, win rates, bookings, and active pipeline by sales rep", async () => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const periodEnd = new Date(now.getTime() + 1000);

      // Rep 1 (Jane Doe):
      // Deal 1: won, $40,000
      const rep1DealWon1 = await Deal.create({
        organizationId: testOrg._id,
        name: "Jane Won Deal 1",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        ownerId: salesRep1._id,
        stage: "closed_won",
        value: 40000,
        currency: "USD",
        annualRecurringRevenue: 40000,
        oneTimeImplementationFee: 0,
        probability: 1.0,
        actualCloseDate: now,
      });

      // Deal 2: won, $20,000
      const rep1DealWon2 = await Deal.create({
        organizationId: testOrg._id,
        name: "Jane Won Deal 2",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        ownerId: salesRep1._id,
        stage: "closed_won",
        value: 20000,
        currency: "USD",
        annualRecurringRevenue: 20000,
        oneTimeImplementationFee: 0,
        probability: 1.0,
        actualCloseDate: now,
      });

      // Deal 3: lost, $15,000
      const rep1DealLost = await Deal.create({
        organizationId: testOrg._id,
        name: "Jane Lost Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        ownerId: salesRep1._id,
        stage: "closed_lost",
        value: 15000,
        currency: "USD",
        annualRecurringRevenue: 15000,
        oneTimeImplementationFee: 0,
        probability: 0.0,
        updatedAt: now,
      });

      // Deal 4: open, $35,000
      const rep1DealOpen = await Deal.create({
        organizationId: testOrg._id,
        name: "Jane Open Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        ownerId: salesRep1._id,
        stage: "negotiation",
        value: 35000,
        currency: "USD",
        annualRecurringRevenue: 35000,
        oneTimeImplementationFee: 0,
        probability: 0.8,
      });

      // Rep 2 (John Smith):
      // Deal 1: won, $25,000
      const rep2DealWon = await Deal.create({
        organizationId: testOrg._id,
        name: "John Won Deal",
        companyId: testCompany._id,
        primaryContactId: testContact._id,
        pipelineId: testPipeline._id,
        ownerId: salesRep2._id,
        stage: "closed_won",
        value: 25000,
        currency: "USD",
        annualRecurringRevenue: 25000,
        oneTimeImplementationFee: 0,
        probability: 1.0,
        actualCloseDate: now,
      });

      createdDealIds.push(
        rep1DealWon1._id,
        rep1DealWon2._id,
        rep1DealLost._id,
        rep1DealOpen._id,
        rep2DealWon._id
      );

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/analytics/rep-performance?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}&pipelineId=${testPipeline._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body).data;

      expect(data.reps.length).toBeGreaterThanOrEqual(2);

      const jane = data.reps.find((r: any) => r.repId === salesRep1._id.toString());
      expect(jane).toBeDefined();
      expect(jane.repName).toBe("Jane Doe");
      expect(jane.repEmail).toBe(`anl002-rep1-${testPrefix}@talnova.test`);
      expect(jane.dealsWon).toBe(2);
      expect(jane.dealsLost).toBe(1);
      expect(jane.dealsClosed).toBe(3);
      // winRate = 2 / 3 * 100 = 66.7%
      expect(jane.winRate).toBe(66.7);
      // total bookings = 40000 + 20000 = $60,000
      expect(jane.totalBookings).toBe(60000);
      // average deal size = 60000 / 2 = $30,000
      expect(jane.averageDealSize).toBe(30000);
      // active pipeline = $35,000
      expect(jane.activePipelineValue).toBe(35000);
      expect(jane.openDealsCount).toBe(1);

      const john = data.reps.find((r: any) => r.repId === salesRep2._id.toString());
      expect(john).toBeDefined();
      expect(john.repName).toBe("John Smith");
      expect(john.dealsWon).toBe(1);
      expect(john.dealsLost).toBe(0);
      expect(john.winRate).toBe(100.0);
      expect(john.totalBookings).toBe(25000);
      expect(john.averageDealSize).toBe(25000);

      // Reps sorted descending by totalBookings: Jane ($60,000) should appear before John ($25,000)
      const janeIndex = data.reps.findIndex((r: any) => r.repId === salesRep1._id.toString());
      const johnIndex = data.reps.findIndex((r: any) => r.repId === salesRep2._id.toString());
      expect(janeIndex).toBeLessThan(johnIndex);

      // Team summary
      expect(data.teamSummary.totalBookings).toBeGreaterThanOrEqual(85000);
      expect(data.teamSummary.totalDealsWon).toBeGreaterThanOrEqual(3);
    });
  });
});
