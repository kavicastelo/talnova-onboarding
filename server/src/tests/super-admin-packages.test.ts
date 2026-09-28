import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Package from "../modules/super-admin/models/package.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";
import { superAdminService } from "../modules/super-admin/services/super-admin.service.js";

describe("Super Admin: Modular Package & Plan Creator, Hybrid Pricing & Dynamic Entitlements", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let rootOrg: any;
  let testOrg: any;
  let superAdminToken: string;

  const testRunId = `pkg-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Seed default baseline packages
    await superAdminService.syncDefaultPackages();

    const dummyId = new mongoose.Types.ObjectId();

    rootOrg = await Organization.create({
      name: `Super Admin Org ${testRunId}`,
      slug: `root-${testRunId}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    superAdminUser = await User.create({
      organizationId: rootOrg._id,
      auth: {
        email: `superadmin-${testRunId}@talnova.test`,
        passwordHash: "dummy_hash_for_test",
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

    // Create a target tenant organization for testing package assignment
    testOrg = await Organization.create({
      name: `Acme Logistics ${testRunId}`,
      slug: `acme-${testRunId}`,
      plan: "Starter",
      status: "Active",
      createdBy: superAdminUser._id,
      limits: {
        maxUsers: 5,
        maxStorageGb: 1,
      },
    });
  });

  afterAll(async () => {
    await User.deleteMany({ auth: { email: { $regex: testRunId } } });
    await Organization.deleteMany({ slug: { $regex: testRunId } });
    await Package.deleteMany({ slug: { $regex: testRunId } });
    await app.close();
  });

  it("1. Baseline packages are seeded and accessible via GET /api/v1/super-admin/packages", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/packages",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.packages)).toBe(true);
    expect(body.data.packages.length).toBeGreaterThanOrEqual(4);

    const freemium = body.data.packages.find((p: any) => p.slug === "freemium");
    expect(freemium).toBeDefined();
    expect(freemium.billing.basePriceMonthly).toBe(0);
    expect(freemium.isDefault).toBe(true);

    const kioskSuite = body.data.packages.find((p: any) => p.slug === "kiosk-suite");
    expect(kioskSuite).toBeDefined();
    expect(kioskSuite.limits.maxKiosks).toBeGreaterThan(0);
    expect(Array.isArray(body.data.canonicalFeatures)).toBe(true);
  });

  it("2. Super Admin can create a custom modular package with base limits and add-on pricing", async () => {
    const customSlug = `custom-security-${testRunId}`;
    const payload = {
      name: "Security & Ops Suite",
      slug: customSlug,
      description: "Dedicated security, compliance vault, and edge kiosk stations.",
      badge: "High Security",
      tier: "custom",
      isPublic: true,
      billing: {
        basePriceMonthly: 199,
        basePriceAnnual: 1990,
        currency: "USD",
      },
      limits: {
        maxUsers: 50,
        maxStorageGb: 100,
        maxJourneys: 25,
        maxKiosks: 10,
        aiTokenMonthlyLimit: 500000,
      },
      features: [
        {
          featureKey: "compliance_vault",
          name: "Audit & Compliance Vault",
          module: "compliance",
          enabled: true,
          isAddOn: false,
        },
        {
          featureKey: "kiosk_mode",
          name: "Terminal Kiosk Mode",
          module: "operations",
          enabled: true,
          isAddOn: true,
          addOnPriceMonthly: 49,
          addOnPriceAnnual: 490,
        },
        {
          featureKey: "predictive_attrition",
          name: "Predictive Attrition Intelligence",
          module: "intelligence",
          enabled: false,
          isAddOn: true,
          addOnPriceMonthly: 79,
          addOnPriceAnnual: 790,
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/packages",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe(customSlug);
    expect(body.data.limits.maxKiosks).toBe(10);
    expect(body.data.features.length).toBeGreaterThanOrEqual(3);
  });

  it("3. Super Admin can clone an existing package template", async () => {
    const kioskPkg = await Package.findOne({ slug: "kiosk-suite" });
    expect(kioskPkg).toBeDefined();

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/packages/${kioskPkg!._id}/clone`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toContain("(Copy)");
    expect(body.data.slug).toContain("copy");

    // Clean up cloned package
    await Package.findByIdAndDelete(body.data._id);
  });

  it("4. Super Admin assigns package to organization with automatic hybrid price calculation & limits update", async () => {
    const growthPkg = await Package.findOne({ slug: "growth-suite" });
    expect(growthPkg).toBeDefined();

    // Assign Growth Suite with an add-on: "kiosk_mode" (+ $49/mo)
    const assignPayload = {
      packageId: growthPkg!._id.toString(),
      billingInterval: "monthly",
      activeAddOns: ["kiosk_mode"],
      reason: "Client upgraded from Starter with Kiosk add-on",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/assign-package`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: assignPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.organization.packageSlug).toBe("growth-suite");

    // Hybrid calculation: base ($249) + kiosk add-on ($49) = $298
    const expectedBase = growthPkg!.billing.basePriceMonthly;
    const kioskAddonPrice = growthPkg!.features.find((f: any) => f.featureKey === "kiosk_mode")?.addOnPriceMonthly || 49;
    const expectedTotal = expectedBase + kioskAddonPrice;

    expect(body.data.organization.subscription.basePrice).toBe(expectedBase);
    expect(body.data.organization.subscription.addOnsTotal).toBe(kioskAddonPrice);
    expect(body.data.organization.subscription.finalPrice).toBe(expectedTotal);

    // Verify tenant limits updated to Growth Suite limits
    const updatedOrg = await Organization.findById(testOrg._id);
    expect(updatedOrg!.limits.maxUsers).toBe(growthPkg!.limits.maxUsers);
    expect(updatedOrg!.limits.maxStorageGb).toBe(growthPkg!.limits.maxStorageGb);
  });

  it("5. Super Admin can assign package with custom negotiated contract override price", async () => {
    const enterprisePkg = await Package.findOne({ slug: "enterprise" });
    expect(enterprisePkg).toBeDefined();

    const negotiatedPrice = 399; // Standard is $499, discounted to $399
    const assignPayload = {
      packageId: enterprisePkg!._id.toString(),
      billingInterval: "monthly",
      customPrice: negotiatedPrice,
      reason: "Negotiated enterprise volume discount",
    };

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/assign-package`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: assignPayload,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.organization.subscription.customPrice).toBe(negotiatedPrice);
    expect(body.data.organization.subscription.finalPrice).toBe(negotiatedPrice);

    // Verify FeatureFlag targetOrganizationIds contains the testOrg
    const flags = await FeatureFlag.find({ targetOrganizationIds: testOrg._id });
    expect(flags.length).toBeGreaterThan(0);
  });

  it("6. Super Admin cannot delete a package currently in use by an active tenant (soft archives instead)", async () => {
    const enterprisePkg = await Package.findOne({ slug: "enterprise" });
    expect(enterprisePkg).toBeDefined();

    // testOrg is currently assigned to enterprisePkg
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/packages/${enterprisePkg!._id}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.action).toBe("archived");

    // Verify it was archived rather than dropped from DB
    const checkPkg = await Package.findById(enterprisePkg!._id);
    expect(checkPkg).toBeDefined();
    expect(checkPkg!.status).toBe("archived");

    // Restore to active for system health
    checkPkg!.status = "active";
    await checkPkg!.save();
  });

  it("7. Super Admin can assign package using organization slug and gets 400 when orgId is undefined", async () => {
    const freemiumPkg = await Package.findOne({ slug: "freemium" });
    expect(freemiumPkg).toBeDefined();

    // A. Assign via slug
    const resSlug = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg.slug}/assign-package`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        packageId: freemiumPkg!._id.toString(),
        billingInterval: "monthly",
      },
    });

    expect(resSlug.statusCode).toBe(200);
    const bodySlug = resSlug.json();
    expect(bodySlug.success).toBe(true);
    expect(bodySlug.data.organization.plan).toBe(freemiumPkg!.name);

    // B. Rejection when orgId is literal "undefined"
    const resUndefined = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/undefined/assign-package`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        packageId: freemiumPkg!._id.toString(),
      },
    });

    expect(resUndefined.statusCode).toBe(400);
  });
});
