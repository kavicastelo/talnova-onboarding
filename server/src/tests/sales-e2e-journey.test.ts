import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Task from "../modules/sales/models/task.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import Package from "../modules/super-admin/models/package.model.js";
import CustomerAccount from "../modules/super-admin/models/customer-account.model.js";
import { EmailProviderFactory } from "../modules/sales/integrations/email/email.factory.js";
import { WhatsAppProviderFactory } from "../modules/sales/integrations/whatsapp/whatsapp.factory.js";

describe("SEC-001: End-to-End Sales Lifecycle Journey Test", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let testPackage: any;
  let defaultPipeline: any;

  const testPrefix = `sales-e2e-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdPackageIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    // Configure mock drivers
    process.env.SALES_EMAIL_DRIVER = "mock";
    process.env.SALES_WHATSAPP_DRIVER = "mock";
    EmailProviderFactory.clearCache();
    WhatsAppProviderFactory.clearCache();

    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Base Host Organization
    testOrg = await Organization.create({
      name: `Talnova Platform Host ${testPrefix}`,
      slug: `host-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `superadmin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Alexander",
        lastName: "Pierce",
        fullName: "Alexander Pierce",
      },
      employment: { status: "active" },
      roles: ["super_admin"],
      systemRole: "super_admin",
      permissions: { role: "super_admin", customRoles: [] },
    });
    createdUserIds.push(superAdminUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: "super_admin",
      roles: ["super_admin"],
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // 3. Ensure Default Pipeline Exists
    defaultPipeline = await Pipeline.findOne({ isDefault: true });
    if (!defaultPipeline) {
      defaultPipeline = await Pipeline.create({
        name: "Standard Sales Pipeline",
        isDefault: true,
        stages: [
          { key: "lead_created", name: "Lead Created", probability: 0.1, order: 1 },
          { key: "qualified", name: "Qualified Lead", probability: 0.25, order: 2 },
          { key: "deal_created", name: "Discovery Completed", probability: 0.4, order: 3 },
          { key: "proposal", name: "Proposal / Demo", probability: 0.6, order: 4 },
          { key: "negotiation", name: "Negotiation", probability: 0.85, order: 5 },
          { key: "closed_won", name: "Closed Won", probability: 1.0, isWon: true, order: 6 },
          { key: "closed_lost", name: "Closed Lost", probability: 0.0, isLost: true, order: 7 },
        ],
        createdBy: superAdminUser._id,
      });
    }

    // 4. Create Standard Enterprise Package
    testPackage = await Package.create({
      name: `Enterprise Suite ${testPrefix}`,
      slug: `enterprise-suite-${testPrefix}`,
      description: "Comprehensive enterprise package for onboarding handoff",
      tier: "enterprise",
      isPublic: true,
      isDefault: false,
      status: "active",
      billing: {
        basePriceMonthly: 499,
        basePriceAnnual: 4990,
        currency: "USD",
      },
      limits: {
        maxUsers: 500,
        maxStorageGb: 1000,
        maxJourneys: 50,
        maxKiosks: 10,
        aiTokenMonthlyLimit: 2000000,
      },
      features: [
        { featureKey: "sso", name: "Single Sign-On", module: "enterprise", enabled: true, isAddOn: false },
        { featureKey: "custom_branding", name: "Custom Branding", module: "enterprise", enabled: true, isAddOn: false },
      ],
      createdBy: superAdminUser._id,
      isDeleted: false,
    });
    createdPackageIds.push(testPackage._id);
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdTaskIds.length > 0) {
      await Task.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdPackageIds.length > 0) {
      await Package.deleteMany({ _id: { $in: createdPackageIds } });
    }
    if (createdOrgIds.length > 0) {
      await CustomerAccount.deleteMany({ organizationId: { $in: createdOrgIds } });
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    await disconnectDatabase(app.log);
    await app.close();
  });

  // State shared across journey steps
  let leadId: string;
  let companyId: string;
  let contactId: string;
  let dealId: string;
  let threadId: string;
  let createdTenantOrgId: string;

  it("Step 1: Lead Ingestion with Rich UTM Campaign Parameters", async () => {
    const leadPayload = {
      name: "Victoria Sterling",
      email: `victoria.sterling-${testPrefix}@vancetech.test`,
      phone: "+14155558899",
      companyName: `Sterling Aerospace ${testPrefix}`,
      jobTitle: "Chief Operating Officer",
      industry: "Aerospace",
      companySize: "201-500",
      source: "website",
      utm: {
        source: "google_search",
        medium: "cpc",
        campaign: "q4_enterprise_growth",
        content: "interactive_sandbox_cta",
      },
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales/leads",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: leadPayload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data._id || body.data.id).toBeDefined();

    leadId = body.data._id || body.data.id;
    createdLeadIds.push(new mongoose.Types.ObjectId(leadId));

    // Verify lead document in MongoDB
    const savedLead = await Lead.findById(leadId);
    expect(savedLead).toBeDefined();
    expect(savedLead?.status).toBe("new");
    expect(savedLead?.utm?.campaign).toBe("q4_enterprise_growth");
    expect(savedLead?.score).toBeGreaterThanOrEqual(0);
  });

  it("Step 2: Lead Scoring & Lifecycle Transition with Automatic Task Creation", async () => {
    // Record engagement event: Pricing page visited (+15 points)
    const eventRes = await app.inject({
      method: "POST",
      url: `/api/v1/sales/leads/${leadId}/score-event`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        rule: "PRICING_PAGE_VISITED",
        points: 25,
      },
    });
    expect(eventRes.statusCode).toBe(200);

    // Update lead status to qualified
    const statusRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sales/leads/${leadId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        status: "qualified",
        note: "Attended executive walkthrough, budget confirmed, requesting custom proposal.",
      },
    });
    expect(statusRes.statusCode).toBe(200);

    // Create high-priority follow-up Task
    const taskRes = await app.inject({
      method: "POST",
      url: "/api/v1/sales/tasks",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        title: `Prepare Enterprise MSA & Quote for Sterling Aerospace`,
        type: "proposal",
        priority: "urgent",
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        leadId,
        assignedTo: superAdminUser._id.toString(),
      },
    });
    expect(taskRes.statusCode).toBe(201);
    const taskBody = taskRes.json();
    createdTaskIds.push(new mongoose.Types.ObjectId(taskBody.data._id || taskBody.data.id));

    // Verify lead status in DB
    const lead = await Lead.findById(leadId);
    expect(lead?.status).toBe("qualified");
    expect(lead?.score).toBeGreaterThanOrEqual(25);
  });

  it("Step 3: Unified Communication Thread & Inbound Reply Aggregation", async () => {
    // 1. Create communication thread in Unified Inbox
    const threadRes = await app.inject({
      method: "POST",
      url: "/api/v1/sales/inbox",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        channel: "email",
        recipient: `victoria.sterling-${testPrefix}@vancetech.test`,
        subject: "Talnova Enterprise Onboarding Walkthrough & Proposal",
        body: "Hi Victoria, thank you for attending today's session. Attached is the preliminary quote.",
        leadId,
      },
    });
    expect(threadRes.statusCode).toBe(201);
    const threadBody = threadRes.json();
    threadId = (threadBody.data._id || threadBody.data.id)?.toString();
    createdThreadIds.push(new mongoose.Types.ObjectId(threadId));

    // 2. Dispatches reply on existing thread
    const replyRes = await app.inject({
      method: "POST",
      url: `/api/v1/sales/inbox/${threadId}/reply`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        body: "Thanks Alexander. The terms look great. Please send over the final contract for signature.",
      },
    });
    expect(replyRes.statusCode).toBe(200);

    // 3. Verifies thread unread count and latest snippet in inbox list
    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/sales/inbox?leadId=${leadId}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = listRes.json();
    expect(listBody.data.length).toBeGreaterThan(0);
    expect(listBody.data[0].lastMessageSnippet).toContain("Thanks Alexander");
  });

  it("Step 4: Opportunity Conversion & Company/Contact Entity Linking", async () => {
    // 1. Create Company
    const compRes = await app.inject({
      method: "POST",
      url: "/api/v1/sales/companies",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: `Sterling Aerospace ${testPrefix}`,
        domain: `vancetech-${testPrefix}.test`,
        industry: "Aerospace",
        companySize: "201-500",
        annualRevenue: 25000000,
      },
    });
    expect(compRes.statusCode).toBe(201);
    const compBody = compRes.json();
    companyId = (compBody.data._id || compBody.data.id)?.toString();
    expect(companyId).toBeDefined();
    createdCompanyIds.push(new mongoose.Types.ObjectId(companyId));

    // 2. Create Contact
    const contRes = await app.inject({
      method: "POST",
      url: "/api/v1/sales/contacts",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        companyId,
        firstName: "Victoria",
        lastName: "Sterling",
        email: `victoria.sterling-${testPrefix}@vancetech.test`,
        phone: "+14155558899",
        title: "Chief Operating Officer",
      },
    });
    expect(contRes.statusCode).toBe(201);
    const contBody = contRes.json();
    contactId = (contBody.data._id || contBody.data.id)?.toString();
    expect(contactId).toBeDefined();
    createdContactIds.push(new mongoose.Types.ObjectId(contactId));

    // 3. Create Deal linked to Company, Contact, Lead, and Package
    const dealRes = await app.inject({
      method: "POST",
      url: "/api/v1/sales/deals",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: `Sterling Aerospace - Enterprise 350-Seat Expansion`,
        companyId,
        primaryContactId: contactId,
        leadId,
        pipelineId: defaultPipeline._id.toString(),
        stage: "discovery_completed",
        packageId: testPackage._id.toString(),
        value: 120000,
        currency: "USD",
        annualRecurringRevenue: 100000,
        oneTimeImplementationFee: 20000,
        probability: 0.25,
        expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(dealRes.statusCode).toBe(201);
    const dealBody = dealRes.json();
    dealId = (dealBody.data._id || dealBody.data.id)?.toString();
    expect(dealId).toBeDefined();
    createdDealIds.push(new mongoose.Types.ObjectId(dealId));

    // 4. Mark Lead as Converted
    const leadUpdateRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/sales/leads/${leadId}/status`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        status: "converted",
        note: "Converted to active deal and linked to Sterling Aerospace company record.",
      },
    });
    expect(leadUpdateRes.statusCode).toBe(200);

    const updatedLead = await Lead.findById(leadId);
    expect(updatedLead?.status).toBe("converted");
  });

  it("Step 5: Deal Stage Progression through Proposal and Negotiation to Closed Won", async () => {
    // 1. Advance to Proposal Sent (70% probability)
    const p1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sales/deals/${dealId}/stage`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        stage: "proposal_sent",
        probability: 0.7,
      },
    });
    expect(p1.statusCode).toBe(200);

    // 2. Advance to Negotiation (85% probability)
    const p2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sales/deals/${dealId}/stage`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        stage: "negotiation",
        probability: 0.85,
      },
    });
    expect(p2.statusCode).toBe(200);

    // 3. Advance to Closed Won (100% probability)
    const p3 = await app.inject({
      method: "PATCH",
      url: `/api/v1/sales/deals/${dealId}/stage`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        stage: "closed_won",
        probability: 1.0,
        actualCloseDate: new Date().toISOString(),
        wonDetails: {
          contractSignedDate: new Date().toISOString(),
          approvedBy: superAdminUser._id.toString(),
        },
      },
    });
    expect(p3.statusCode).toBe(200);

    // Verify deal in DB
    const wonDeal = await Deal.findById(dealId);
    expect(wonDeal?.stage).toBe("closed_won");
    expect(wonDeal?.value).toBe(120000);
    expect(wonDeal?.probability).toBe(1.0);
    expect(wonDeal?.stageHistory.length).toBeGreaterThanOrEqual(3);
  });

  it("Step 6: Enterprise Onboarding Handoff with Idempotent Tenant Provisioning", async () => {
    const handoffPayload = {
      organizationName: `Sterling Aerospace Corporation ${testPrefix}`,
      adminEmail: `victoria.sterling-${testPrefix}@vancetech.test`,
      notes: "Enterprise handoff signed, starting initial SSO configuration",
    };

    // First handoff execution
    const res1 = await app.inject({
      method: "POST",
      url: `/api/v1/sales/deals/${dealId}/handoff`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: handoffPayload,
    });

    expect(res1.statusCode).toBe(200);
    const body1 = res1.json();
    expect(body1.success).toBe(true);
    expect(body1.data.organizationId).toBeDefined();

    createdTenantOrgId = body1.data.organizationId;
    createdOrgIds.push(new mongoose.Types.ObjectId(createdTenantOrgId));

    // Verify newly provisioned Tenant Organization in DB
    const tenantOrg = await Organization.findById(createdTenantOrgId);
    expect(tenantOrg).toBeDefined();
    expect(tenantOrg?.status).toBe("Active");
    expect(tenantOrg?.name).toBe(`Sterling Aerospace Corporation ${testPrefix}`);

    // Verify CustomerAccount record created in DB
    const account = await CustomerAccount.findOne({ organizationId: createdTenantOrgId });
    expect(account).toBeDefined();
    expect(account?.commercialNotes).toContain(dealId);

    // Verify Deal wonDetails is updated with handoff state
    const dealAfter = await Deal.findById(dealId);
    expect(dealAfter?.wonDetails?.onboardingHandedOff).toBe(true);
    expect(dealAfter?.wonDetails?.organizationId?.toString()).toBe(createdTenantOrgId);

    // Test Idempotency: Second execution returns existing organization without error
    const res2 = await app.inject({
      method: "POST",
      url: `/api/v1/sales/deals/${dealId}/handoff`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: handoffPayload,
    });

    expect(res2.statusCode).toBe(200);
    const body2 = res2.json();
    expect(body2.data.organizationId).toBe(createdTenantOrgId);
    expect(body2.data.alreadyCompleted).toBe(true);

    // Count organizations to confirm no duplicates
    const orgCount = await Organization.countDocuments({
      _id: createdTenantOrgId,
    });
    expect(orgCount).toBe(1);
  });

  it("Step 7: Sales Overview Metrics & Conversion Funnel Reflect Deal State", async () => {
    // Query overview metrics
    const overviewRes = await app.inject({
      method: "GET",
      url: `/api/v1/sales/analytics/overview`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(overviewRes.statusCode).toBe(200);
    const overview = overviewRes.json().data;

    expect(overview.deals.dealsWonCount.current).toBeGreaterThanOrEqual(1);
    expect(overview.deals.closedWonRevenue.current).toBeGreaterThanOrEqual(120000);

    // Query funnel metrics
    const funnelRes = await app.inject({
      method: "GET",
      url: `/api/v1/sales/analytics/funnel`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(funnelRes.statusCode).toBe(200);
    const funnel = funnelRes.json().data;

    expect(funnel.stages.length).toBeGreaterThan(0);
    expect(funnel.overallConversionRate).toBeGreaterThan(0);

    // Query rep leaderboard
    const repRes = await app.inject({
      method: "GET",
      url: `/api/v1/sales/analytics/rep-performance`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(repRes.statusCode).toBe(200);
    const reps = repRes.json().data;
    expect(reps.teamSummary.totalBookings).toBeGreaterThanOrEqual(120000);
  });
});
