import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";
import FeatureFlagService from "../modules/super-admin/services/feature-flag.service.js";

describe("SA-PF-002: Runtime Feature Flag Resolution & Tenant Product Enforcement", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let orgAAdminUser: any;
  let orgBAdminUser: any;
  let orgA: any;
  let orgB: any;
  let superAdminToken: string;
  let orgAToken: string;
  let orgBToken: string;

  const testPrefix = `rt-flag-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A (Targeted) and Organization B (Standard/Excluded)
    orgA = await Organization.create({
      name: `Whitelisted Tenant Alpha ${testPrefix}`,
      slug: `alpha-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    orgB = await Organization.create({
      name: `Standard Tenant Beta ${testPrefix}`,
      slug: `beta-${testPrefix}`,
      plan: "Growth",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Super Admin User
    superAdminUser = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `super-${testPrefix}@talnova.test`,
        passwordHash: "mock_hash",
      },
      profile: { firstName: "Super", lastName: "Admin", fullName: "Super Admin" },
      employment: { status: "active", department: "IT" },
      permissions: { role: "super_admin" },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: orgA._id.toString(),
      role: "super_admin",
    });

    // 3. Org A Admin User
    orgAAdminUser = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `admin-a-${testPrefix}@talnova.test`,
        passwordHash: "mock_hash",
      },
      profile: { firstName: "Admin", lastName: "A", fullName: "Admin Alpha" },
      employment: { status: "active", department: "HR" },
      permissions: { role: "admin" },
    });

    orgAToken = app.jwt.sign({
      userId: orgAAdminUser._id.toString(),
      organizationId: orgA._id.toString(),
      role: "admin",
    });

    // 4. Org B Admin User
    orgBAdminUser = await User.create({
      organizationId: orgB._id,
      auth: {
        email: `admin-b-${testPrefix}@talnova.test`,
        passwordHash: "mock_hash",
      },
      profile: { firstName: "Admin", lastName: "B", fullName: "Admin Beta" },
      employment: { status: "active", department: "Operations" },
      permissions: { role: "admin" },
    });

    orgBToken = app.jwt.sign({
      userId: orgBAdminUser._id.toString(),
      organizationId: orgB._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    // Reset standard flags
    await FeatureFlag.updateOne(
      { key: "ai_course_builder" },
      { $set: { isEnabled: true, targetOrganizationIds: [], excludedOrganizationIds: [], rolloutPercentage: 100 } }
    );
    await FeatureFlag.updateOne(
      { key: "kiosk_mode" },
      { $set: { isEnabled: true, targetOrganizationIds: [], excludedOrganizationIds: [], rolloutPercentage: 100 } }
    );
    FeatureFlagService.invalidateCache();

    if (orgA) await Organization.deleteOne({ _id: orgA._id });
    if (orgB) await Organization.deleteOne({ _id: orgB._id });
    if (superAdminUser) await User.deleteOne({ _id: superAdminUser._id });
    if (orgAAdminUser) await User.deleteOne({ _id: orgAAdminUser._id });
    if (orgBAdminUser) await User.deleteOne({ _id: orgBAdminUser._id });
  });

  it("1. Global Kill Switch: Disabling ai_course_builder blocks tenant requests with HTTP 403 FEATURE_DISABLED", async () => {
    // Disable globally with no overrides
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: false,
        targetOrganizationIds: [],
        excludedOrganizationIds: [],
        reason: "Kill switch activated for test",
      },
    });

    // Org B attempts to call AI Course generator
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: { authorization: `Bearer ${orgBToken}` },
      payload: {
        topic: "Enterprise Cybersecurity",
        targetAudience: "All Employees",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("FEATURE_DISABLED");
    expect(body.message).toContain("This feature is currently disabled by platform administration");
  });

  it("2. Organization Override: Whitelisted tenant can access feature while standard tenant is blocked", async () => {
    // Whitelist Org A while keeping flag globally disabled
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: false,
        targetOrganizationIds: [orgA._id.toString()],
        excludedOrganizationIds: [],
        reason: "Org A beta trial access",
      },
    });

    // 1. Org B (Standard, no override) receives 403 FEATURE_DISABLED
    const resB = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: { authorization: `Bearer ${orgBToken}` },
      payload: { topic: "Sales Enablement" },
    });
    expect(resB.statusCode).toBe(403);
    expect(JSON.parse(resB.body).code).toBe("FEATURE_DISABLED");

    // 2. Org A (Whitelisted override) passes the feature flag check!
    const resA = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: { authorization: `Bearer ${orgAToken}` },
      payload: { topic: "Sales Enablement", audience: "Sales" },
    });
    // Should NOT be 403 FEATURE_DISABLED (it proceeds to AI controller)
    expect(resA.statusCode).not.toBe(403);
  });

  it("3. Strict Exclusion Dominance: Excluded organization is blocked even if globally enabled", async () => {
    // Enable flag globally, but blacklist Org B
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: true,
        targetOrganizationIds: [orgA._id.toString()],
        excludedOrganizationIds: [orgB._id.toString()],
        reason: "Org B quarantine exclusion",
      },
    });

    const resB = await app.inject({
      method: "POST",
      url: "/api/v1/ai/generate-course",
      headers: { authorization: `Bearer ${orgBToken}` },
      payload: { topic: "Leadership 101" },
    });

    expect(resB.statusCode).toBe(403);
    const body = JSON.parse(resB.body);
    expect(body.code).toBe("FEATURE_DISABLED");
  });

  it("4. Kiosk Mode Enforcement: Gating kiosk routes behind kiosk_mode feature flag", async () => {
    // Disable kiosk_mode globally
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/kiosk_mode",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: false,
        targetOrganizationIds: [],
        excludedOrganizationIds: [],
      },
    });

    const kioskRes = await app.inject({
      method: "GET",
      url: "/api/v1/kiosk/journeys",
      headers: { authorization: `Bearer ${orgBToken}` },
    });

    expect(kioskRes.statusCode).toBe(403);
    expect(JSON.parse(kioskRes.body).code).toBe("FEATURE_DISABLED");

    // Re-enable kiosk_mode
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/kiosk_mode",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { isEnabled: true },
    });

    const kioskEnabledRes = await app.inject({
      method: "GET",
      url: "/api/v1/kiosk/journeys",
      headers: { authorization: `Bearer ${orgBToken}` },
    });

    expect(kioskEnabledRes.statusCode).toBe(200);
  });

  it("5. Real-Time Cache Invalidation: Mutation immediately takes effect without server reboot", async () => {
    // Enable flag
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { isEnabled: true, targetOrganizationIds: [], excludedOrganizationIds: [] },
    });

    const check1 = await FeatureFlagService.isEnabled("ai_course_builder", orgB._id.toString(), "admin");
    expect(check1).toBe(true);

    // Disable flag via API (which triggers invalidateCache)
    await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: { isEnabled: false },
    });

    const check2 = await FeatureFlagService.isEnabled("ai_course_builder", orgB._id.toString(), "admin");
    expect(check2).toBe(false);
  });

  it("6. Session Bootstrap: GET /api/v1/auth/me returns resolved features map for tenant organization", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { authorization: `Bearer ${orgAToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.features).toBeDefined();
    expect(typeof body.data.features.ai_course_builder).toBe("boolean");
    expect(typeof body.data.features.kiosk_mode).toBe("boolean");
  });
});
