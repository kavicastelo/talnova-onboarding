import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";

describe("Journey Test UJ-SUP-003: Cross-Tenant Finance & Billing Tracking", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let ownerUser: any;
  let hrAdminUser: any;
  let employeeUser: any;

  let superAdminToken: string;
  let ownerToken: string;
  let hrAdminToken: string;
  let employeeToken: string;

  let testOrgs: any[] = [];
  let testInvoices: any[] = [];
  const testPrefix = `test-fin-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Base Organization for Platform SuperAdmin
    const baseOrg = await Organization.create({
      name: `Talnova Platform Org ${testPrefix}`,
      slug: `platform-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    testOrgs.push(baseOrg);

    // 2. Create SuperAdmin User
    superAdminUser = await User.create({
      organizationId: baseOrg._id,
      auth: {
        email: `superadmin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Root",
        lastName: "SuperAdmin",
      },
      employment: {
        department: "Executive",
        jobTitle: "Platform Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: baseOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Create Tenant Owner User (Non-superadmin)
    ownerUser = await User.create({
      organizationId: baseOrg._id,
      auth: {
        email: `owner-${testPrefix}@tenant.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: { firstName: "Tenant", lastName: "Owner" },
      employment: { department: "Management", jobTitle: "Owner", status: "active" },
      permissions: { role: "owner" },
    });

    ownerToken = app.jwt.sign({
      userId: ownerUser._id.toString(),
      organizationId: baseOrg._id.toString(),
      role: "owner",
    });

    // 4. Create HR Admin User (Non-superadmin)
    hrAdminUser = await User.create({
      organizationId: baseOrg._id,
      auth: {
        email: `hr-${testPrefix}@tenant.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: { firstName: "HR", lastName: "Admin" },
      employment: { department: "People", jobTitle: "HR Admin", status: "active" },
      permissions: { role: "admin" },
    });

    hrAdminToken = app.jwt.sign({
      userId: hrAdminUser._id.toString(),
      organizationId: baseOrg._id.toString(),
      role: "admin",
    });

    // 5. Create Regular Employee User (Non-superadmin)
    employeeUser = await User.create({
      organizationId: baseOrg._id,
      auth: {
        email: `emp-${testPrefix}@tenant.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: { firstName: "Staff", lastName: "Member" },
      employment: { department: "Operations", jobTitle: "Staff", status: "active" },
      permissions: { role: "employee" },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: baseOrg._id.toString(),
      role: "employee",
    });

    // 6. Seed Multi-Tenant Organizations with varying plans
    // Tenant A: Starter Tier ($99/mo)
    const orgStarter = await Organization.create({
      name: `Acme Logistics Starter ${testPrefix}`,
      slug: `acme-starter-${testPrefix}`,
      domain: `acme-starter-${testPrefix}.com`,
      plan: "Starter",
      status: "Active",
      subscription: {
        plan: "Starter",
        status: "active",
        seatLimit: 25,
        billingCycle: "monthly",
      },
      createdBy: dummyId,
      isDeleted: false,
    });
    testOrgs.push(orgStarter);

    // Tenant B: Pro Tier ($299/mo)
    const orgPro = await Organization.create({
      name: `Nova Tech Pro ${testPrefix}`,
      slug: `nova-pro-${testPrefix}`,
      domain: `nova-pro-${testPrefix}.com`,
      plan: "Professional",
      status: "Active",
      subscription: {
        plan: "Professional",
        status: "active",
        seatLimit: 100,
        billingCycle: "monthly",
      },
      createdBy: dummyId,
      isDeleted: false,
    });
    testOrgs.push(orgPro);

    // Tenant C: Enterprise Tier ($999/mo)
    const orgEnterprise = await Organization.create({
      name: `Apex Global Enterprise ${testPrefix}`,
      slug: `apex-enterprise-${testPrefix}`,
      domain: `apex-enterprise-${testPrefix}.com`,
      plan: "Enterprise",
      status: "Active",
      subscription: {
        plan: "Enterprise",
        status: "active",
        seatLimit: 500,
        billingCycle: "monthly",
      },
      createdBy: dummyId,
      isDeleted: false,
    });
    testOrgs.push(orgEnterprise);

    // Tenant D: Suspended Org (should not count towards active MRR)
    const orgSuspended = await Organization.create({
      name: `Dormant Corp ${testPrefix}`,
      slug: `dormant-${testPrefix}`,
      domain: `dormant-${testPrefix}.com`,
      plan: "Growth",
      status: "Suspended",
      subscription: {
        plan: "Growth",
        status: "suspended",
        seatLimit: 50,
      },
      createdBy: dummyId,
      isDeleted: false,
    });
    testOrgs.push(orgSuspended);

    // 7. Seed Test Invoices
    const inv1 = await Invoice.create({
      invoiceNo: `INV-${Date.now()}-1`,
      organization: `Nova Tech Pro ${testPrefix}`,
      amount: 299,
      type: "Invoice",
      status: "Paid",
      dueDate: "2026-10-01",
      description: "Monthly subscription - Pro Tier",
    });
    testInvoices.push(inv1);

    const inv2 = await Invoice.create({
      invoiceNo: `INV-${Date.now()}-2`,
      organization: `Apex Global Enterprise ${testPrefix}`,
      amount: 999,
      type: "Invoice",
      status: "Pending",
      dueDate: "2026-10-15",
      description: "Monthly subscription - Enterprise Tier",
    });
    testInvoices.push(inv2);
  });

  afterAll(async () => {
    // Clean up created resources
    for (const inv of testInvoices) {
      await Invoice.deleteOne({ _id: inv._id });
    }
    for (const org of testOrgs) {
      await User.deleteMany({ organizationId: org._id });
      await Organization.deleteOne({ _id: org._id });
    }
  });

  it("Step 1-2: SuperAdmin navigates to /super-admin/finance and API returns HTTP 200 OK", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.summary).toBeDefined();
    expect(body.data.tierDistribution).toBeDefined();
    expect(body.data.monthlyGrowth).toBeDefined();
    expect(body.data.invoicesSummary).toBeDefined();
  });

  it("Step 3: Financial Summary cards reflect accurate ARR, MRR, active subscriptions, and ARPU", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const { summary } = JSON.parse(response.body).data;

    // Total MRR & ARR checks
    expect(summary.totalMrr).toBeGreaterThan(0);
    expect(summary.totalArr).toBe(summary.totalMrr * 12);

    // Active Subscriptions
    expect(summary.activeSubscriptions).toBeGreaterThanOrEqual(4); // BaseOrg + 3 active test tenants

    // ARPU calculation
    expect(summary.platformUsers).toBeGreaterThan(0);
    const expectedArpu = Number((summary.totalMrr / summary.platformUsers).toFixed(2));
    expect(summary.arpu).toBe(expectedArpu);
  });

  it("Step 4: Subscription Tier Distribution charts render distribution for Starter, Pro, and Enterprise tiers", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const { tierDistribution } = JSON.parse(response.body).data;

    expect(Array.isArray(tierDistribution)).toBe(true);
    expect(tierDistribution.length).toBe(3);

    const starterTier = tierDistribution.find((t: any) => t.tier === "Starter");
    const proTier = tierDistribution.find((t: any) => t.tier === "Pro");
    const enterpriseTier = tierDistribution.find((t: any) => t.tier === "Enterprise");

    expect(starterTier).toBeDefined();
    expect(proTier).toBeDefined();
    expect(enterpriseTier).toBeDefined();

    // Verify all tiers have non-NaN values
    for (const tier of tierDistribution) {
      expect(Number.isNaN(tier.count)).toBe(false);
      expect(Number.isNaN(tier.mrr)).toBe(false);
      expect(Number.isNaN(tier.arr)).toBe(false);
      expect(Number.isNaN(tier.percentage)).toBe(false);
      expect(tier.percentage).toBeGreaterThanOrEqual(0);
      expect(tier.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }

    // At least 1 starter, 1 pro, 1 enterprise from our seeded test orgs
    expect(starterTier.count).toBeGreaterThanOrEqual(1);
    expect(proTier.count).toBeGreaterThanOrEqual(1);
    expect(enterpriseTier.count).toBeGreaterThanOrEqual(1);
  });

  it("Alternative Path: SuperAdmin exports cross-tenant billing report summary via GET /finance/export", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/export",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("finance-summary.csv");

    const csvContent = response.body;
    expect(csvContent).toContain("Organization,Domain,Plan,Status,Seats,MRR ($),ARR ($),Created At");
    expect(csvContent).toContain("Acme Logistics Starter");
    expect(csvContent).toContain("Apex Global Enterprise");
  });

  it("Negative Test: Request without Authorization header is rejected with HTTP 401 Unauthorized", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
    });

    expect(response.statusCode).toBe(401);
  });

  it("Authorization Tests: Non-superadmin roles (tenant owner, HR admin, employee) are rejected with HTTP 403 Forbidden", async () => {
    // 1. Tenant Owner Attempt
    const ownerRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    expect(ownerRes.statusCode).toBe(403);

    // 2. HR Admin Attempt
    const hrRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: { Authorization: `Bearer ${hrAdminToken}` },
    });
    expect(hrRes.statusCode).toBe(403);

    // 3. Employee Attempt
    const empRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    expect(empRes.statusCode).toBe(403);
  });

  it("Data Integrity Check: Total MRR equals exact sum of active tenant subscription pricing in MongoDB", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const { summary } = JSON.parse(response.body).data;

    // Directly query MongoDB to compute expected MRR
    const PLAN_PRICES: Record<string, number> = {
      Starter: 99,
      Growth: 199,
      Pro: 299,
      Professional: 299,
      Enterprise: 999,
    };

    const activeDbOrgs = await Organization.find({
      isDeleted: false,
      status: "Active",
    });

    let expectedDbMrr = 0;
    for (const org of activeDbOrgs) {
      const plan = org.plan || org.subscription?.plan || "Starter";
      const price = (org.subscription as any)?.price ?? (PLAN_PRICES[plan] || 99);
      expectedDbMrr += price;
    }

    expect(summary.totalMrr).toBe(expectedDbMrr);
    expect(summary.totalArr).toBe(expectedDbMrr * 12);
  });
});
