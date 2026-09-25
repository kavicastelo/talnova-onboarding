import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";
import FeatureFlagService from "../modules/super-admin/services/feature-flag.service.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("SA-ORG-FLAGS: Super Admin Organization Feature Flag Management & Overrides", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let superAdminToken: string;
  let testOrgA: any;
  let testOrgB: any;
  const testPrefix = `orgflag_${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A & B
    testOrgA = await Organization.create({
      name: `Acme Corp ${testPrefix}`,
      slug: `acme-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    testOrgB = await Organization.create({
      name: `Beta Inc ${testPrefix}`,
      slug: `beta-${testPrefix}`,
      plan: "Growth",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrgA._id,
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
      organizationId: testOrgA._id.toString(),
      role: "super_admin",
    });
  });

  afterAll(async () => {
    if (testOrgA) await Organization.deleteOne({ _id: testOrgA._id });
    if (testOrgB) await Organization.deleteOne({ _id: testOrgB._id });
    if (superAdminUser) await User.deleteOne({ _id: superAdminUser._id });
    await FeatureFlag.deleteMany({ key: new RegExp(testPrefix) });
    await AuditLog.deleteMany({ description: new RegExp(testPrefix) });
    FeatureFlagService.invalidateCache();
    await app.close();
  });

  it("1. GET /organizations/:id/flags returns flags catalog with effective status for the tenant", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/flags`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.organization.id).toBe(testOrgA._id.toString());
    expect(Array.isArray(body.data.flags)).toBe(true);
    expect(body.data.totalFlags).toBeGreaterThan(0);

    const firstFlag = body.data.flags[0];
    expect(firstFlag).toHaveProperty("key");
    expect(firstFlag).toHaveProperty("override");
    expect(firstFlag).toHaveProperty("effectiveEnabled");
    expect(firstFlag).toHaveProperty("globalEnabled");
  });

  it("2. PATCH /organizations/:id/flags/:key with 'whitelisted' enables a feature specifically for this organization", async () => {
    const flagKey = `canary_ai_${testPrefix}`;
    // Create a flag that is globally disabled
    await FeatureFlag.create({
      key: flagKey,
      name: "Canary AI Builder",
      description: "Testing whitelist override",
      isEnabled: false,
      targetAudience: "global",
      rolloutPercentage: 100,
      targetOrganizationIds: [],
      excludedOrganizationIds: [],
    });

    // Whitelist Org A
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/flags/${flagKey}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        override: "whitelisted",
        reason: `${testPrefix} early beta access`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.override).toBe("whitelisted");
    expect(body.data.effectiveEnabled).toBe(true);
    expect(body.data.globalEnabled).toBe(false);

    // Verify Org B is NOT enabled
    const isOrgBEnabled = await FeatureFlagService.isEnabled(flagKey, testOrgB._id.toString());
    expect(isOrgBEnabled).toBe(false);

    // Verify Org A IS enabled
    const isOrgAEnabled = await FeatureFlagService.isEnabled(flagKey, testOrgA._id.toString());
    expect(isOrgAEnabled).toBe(true);
  });

  it("3. PATCH /organizations/:id/flags/:key with 'blacklisted' disables a feature specifically for this organization", async () => {
    const flagKey = `kiosk_fleet_${testPrefix}`;
    // Create a flag that is globally enabled
    await FeatureFlag.create({
      key: flagKey,
      name: "Kiosk Fleet",
      description: "Testing blacklist exclusion",
      isEnabled: true,
      targetAudience: "global",
      rolloutPercentage: 100,
      targetOrganizationIds: [],
      excludedOrganizationIds: [],
    });

    // Blacklist Org A
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/flags/${flagKey}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        override: "blacklisted",
        reason: `${testPrefix} tenant quarantine`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.override).toBe("blacklisted");
    expect(body.data.effectiveEnabled).toBe(false);
    expect(body.data.globalEnabled).toBe(true);

    // Verify Org A is blocked
    const isOrgAEnabled = await FeatureFlagService.isEnabled(flagKey, testOrgA._id.toString());
    expect(isOrgAEnabled).toBe(false);

    // Verify Org B remains enabled
    const isOrgBEnabled = await FeatureFlagService.isEnabled(flagKey, testOrgB._id.toString());
    expect(isOrgBEnabled).toBe(true);
  });

  it("4. PATCH /organizations/:id/flags/:key with 'default' clears the override and reverts to global state", async () => {
    const flagKey = `canary_ai_${testPrefix}`;

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/flags/${flagKey}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        override: "default",
        reason: `${testPrefix} revert to default`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.override).toBe("default");
    // Since flag is globally disabled, effectiveEnabled is now false
    expect(body.data.effectiveEnabled).toBe(false);

    const isOrgAEnabled = await FeatureFlagService.isEnabled(flagKey, testOrgA._id.toString());
    expect(isOrgAEnabled).toBe(false);
  });

  it("5. POST /organizations/:id/flags/batch performs bulk override updates", async () => {
    const flag1 = `batch_f1_${testPrefix}`;
    const flag2 = `batch_f2_${testPrefix}`;

    await FeatureFlag.create({
      key: flag1,
      name: "Batch Flag 1",
      description: "Batch test 1",
      isEnabled: false,
    });
    await FeatureFlag.create({
      key: flag2,
      name: "Batch Flag 2",
      description: "Batch test 2",
      isEnabled: true,
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/flags/batch`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        updates: [
          { key: flag1, override: "whitelisted" },
          { key: flag2, override: "blacklisted" },
        ],
        reason: `${testPrefix} batch provisioning`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(2);

    expect(body.data[0].override).toBe("whitelisted");
    expect(body.data[0].effectiveEnabled).toBe(true);

    expect(body.data[1].override).toBe("blacklisted");
    expect(body.data[1].effectiveEnabled).toBe(false);
  });

  it("6. GET /organizations/:id/360 includes features summary metadata", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/organizations/${testOrgA._id.toString()}/360`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.features).toBeDefined();
    expect(body.data.features.total).toBeGreaterThan(0);
    expect(body.data.features.overridden).toBeGreaterThanOrEqual(1);
  });
});
