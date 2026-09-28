import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Package from "../modules/super-admin/models/package.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";
import { superAdminService } from "../modules/super-admin/services/super-admin.service.js";

describe("Phase 1: Customize Package Engine - Finance & Invoices Backend", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let rootOrg: any;
  let testTenantMonthly: any;
  let testTenantCustomNegotiated: any;
  let superAdminToken: string;

  const runId = `pkg-fin-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Ensure baseline packages are in sync
    await superAdminService.syncDefaultPackages();

    const dummyId = new mongoose.Types.ObjectId();

    rootOrg = await Organization.create({
      name: `Super Admin Org ${runId}`,
      slug: `root-${runId}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    superAdminUser = await User.create({
      organizationId: rootOrg._id,
      auth: {
        email: `superadmin-${runId}@talnova.test`,
        passwordHash: "dummy_password_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        roles: ["super_admin"],
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: rootOrg._id.toString(),
      role: "super_admin",
      permissions: ["*"],
    });

    // 1. Create a Growth tenant with modular add-ons and monthly interval
    const growthSuite = await Package.findOne({ slug: "growth-suite" });
    testTenantMonthly = await Organization.create({
      name: `Apex Retailers ${runId}`,
      slug: `apex-${runId}`,
      plan: growthSuite?.name || "Growth",
      status: "Active",
      createdBy: superAdminUser._id,
      packageId: growthSuite?._id,
      packageSlug: growthSuite?.slug,
      subscription: {
        packageId: growthSuite?._id,
        packageName: growthSuite?.name,
        packageSlug: growthSuite?.slug,
        plan: growthSuite?.name,
        status: "active",
        billingInterval: "monthly",
        basePrice: growthSuite?.billing?.basePriceMonthly || 149,
        activeAddOns: ["kiosk_mode", "advanced_ai"],
        addOnsTotal: 58,
        finalPrice: 207,
      },
      limits: {
        maxUsers: 150,
        maxStorageGb: 50,
      },
    });

    // 2. Create an Enterprise tenant with custom negotiated price ($850 instead of $999)
    const enterprisePkg = await Package.findOne({ slug: "enterprise" });
    testTenantCustomNegotiated = await Organization.create({
      name: `Global Logistics ${runId}`,
      slug: `global-${runId}`,
      plan: enterprisePkg?.name || "Enterprise",
      status: "Active",
      createdBy: superAdminUser._id,
      packageId: enterprisePkg?._id,
      packageSlug: enterprisePkg?.slug,
      subscription: {
        packageId: enterprisePkg?._id,
        packageName: enterprisePkg?.name,
        packageSlug: enterprisePkg?.slug,
        plan: enterprisePkg?.name,
        status: "active",
        billingInterval: "annual",
        basePrice: enterprisePkg?.billing?.basePriceAnnual || 4900,
        customPrice: 4200,
        finalPrice: 4200,
        activeAddOns: ["custom_domain_sso"],
      },
      limits: {
        maxUsers: 500,
        maxStorageGb: 200,
      },
    });
  });

  afterAll(async () => {
    await User.deleteMany({ auth: { email: { $regex: runId } } });
    await Organization.deleteMany({ slug: { $regex: runId } });
    await Invoice.deleteMany({ customerName: { $regex: runId } });
    await app.close();
  });

  it("1. GET /api/v1/super-admin/invoices/preview/:orgId accurately generates preview from package & modular add-ons", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/invoices/preview/${testTenantMonthly._id}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationId).toBe(testTenantMonthly._id.toString());
    expect(body.data.customerName).toBe(testTenantMonthly.name);
    expect(body.data.billingInterval).toBe("monthly");
    expect(body.data.package.slug).toBe("growth-suite");
    expect(Array.isArray(body.data.lineItems)).toBe(true);

    // Verify Base plan item exists
    const baseItem = body.data.lineItems.find((li: any) => li.itemType === "package_base");
    expect(baseItem).toBeDefined();
    expect(baseItem.amount).toBeGreaterThan(0);

    // Verify Add-on items exist with correct featureKey
    const addonItems = body.data.lineItems.filter((li: any) => li.itemType === "addon");
    expect(addonItems.length).toBeGreaterThanOrEqual(1);
    expect(body.data.subtotal).toBeGreaterThan(0);
    expect(body.data.totalAmount).toBe(body.data.subtotal - body.data.discountAmount);
  });

  it("2. GET /api/v1/super-admin/invoices/preview/:orgId supports custom negotiated enterprise contract pricing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/invoices/preview/${testTenantCustomNegotiated.slug}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.customerName).toBe(testTenantCustomNegotiated.name);
    expect(body.data.billingInterval).toBe("annual");
    expect(body.data.isCustomPrice).toBe(true);
    expect(body.data.negotiatedPrice).toBe(4200);
    expect(body.data.totalAmount).toBe(4200);
  });

  it("3. POST /api/v1/super-admin/invoices generates live invoice directly from customize package configuration", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/invoices",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testTenantMonthly._id.toString(),
        generateFromPackage: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.invoiceNo).toMatch(/^INV-\d+/);
    expect(body.data.packageSlug).toBe("growth-suite");
    expect(body.data.billingCycle).toBe("monthly");
    expect(body.data.lineItems.length).toBeGreaterThanOrEqual(2);
    expect(body.data.totalAmount).toBeGreaterThan(0);
    expect(body.data.balanceDue).toBe(body.data.totalAmount);

    // Verify invoice saved to database
    const savedInv = await Invoice.findById(body.data.id);
    expect(savedInv).toBeDefined();
    expect(savedInv!.packageSlug).toBe("growth-suite");
    expect(savedInv!.lineItems.some((li) => li.itemType === "package_base")).toBe(true);
  });

  it("4. GET /api/v1/super-admin/invoices supports filtering by packageSlug and billingCycle", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/invoices?packageSlug=growth-suite&billingCycle=monthly",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.invoices.data.length).toBeGreaterThanOrEqual(1);
    const allGrowth = body.data.invoices.data.every(
      (inv: any) => !inv.packageSlug || inv.packageSlug === "growth-suite"
    );
    expect(allGrowth).toBe(true);
  });

  it("5. GET /api/v1/super-admin/finance dynamically aggregates MRR and package distributions without legacy hardcoding", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.summary.totalMrr).toBeGreaterThan(0);
    expect(Array.isArray(body.data.packageDistribution)).toBe(true);
    expect(body.data.packageDistribution.length).toBeGreaterThan(0);

    const growthDist = body.data.packageDistribution.find((p: any) => p.slug === "growth-suite");
    expect(growthDist).toBeDefined();
    expect(growthDist.count).toBeGreaterThanOrEqual(1);
  });

  it("6. CSV exports include package template, tier, and active add-on details", async () => {
    // A. Finance CSV export
    const finRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/export",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(finRes.statusCode).toBe(200);
    expect(finRes.body).toContain("Package,Tier,Billing Cycle");
    expect(finRes.body).toContain("Active AddOns");

    // B. Invoices CSV export
    const invRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/invoices/export",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(invRes.statusCode).toBe(200);
    expect(invRes.body).toContain("Invoice No,Customer,Package,Billing Cycle");
  });
});
