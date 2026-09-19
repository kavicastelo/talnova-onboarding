import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";

describe("SA-PF-001: Feature Flag Mongoose Model & Administrative Override APIs", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let orgA: any;
  let orgB: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `ff-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create 2 test organizations for targeting & exclusion overrides
    orgA = await Organization.create({
      name: `Target Tenant Alpha ${testPrefix}`,
      slug: `alpha-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    orgB = await Organization.create({
      name: `Excluded Tenant Beta ${testPrefix}`,
      slug: `beta-${testPrefix}`,
      plan: "Growth",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `superadmin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
      },
      employment: {
        department: "Platform Engineering",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: orgA._id.toString(),
      role: "super_admin",
    });

    // 3. Create Regular Non-Admin User (Employee)
    nonAdminUser = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "User",
        fullName: "Regular User",
      },
      employment: {
        department: "Customer Success",
        jobTitle: "Specialist",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    nonAdminToken = app.jwt.sign({
      userId: nonAdminUser._id.toString(),
      organizationId: orgA._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (orgA) await Organization.deleteOne({ _id: orgA._id });
    if (orgB) await Organization.deleteOne({ _id: orgB._id });
    if (superAdminUser) await User.deleteOne({ _id: superAdminUser._id });
    if (nonAdminUser) await User.deleteOne({ _id: nonAdminUser._id });
    await FeatureFlag.deleteMany({ key: new RegExp(testPrefix) });
    await AuditLog.deleteMany({
      eventCategory: "feature_flag",
      description: new RegExp(testPrefix),
    });
  });

  it("1. FeatureFlag Model: Verifies Mongoose schema compilation and deny precedence method", async () => {
    const flagKey = `canary_${testPrefix}`;
    const testFlag = new FeatureFlag({
      key: flagKey,
      name: "Canary Flight Test",
      description: "Testing deny precedence",
      isEnabled: true,
      targetAudience: "organizations",
      targetOrganizationIds: [orgA._id],
      excludedOrganizationIds: [orgB._id],
      rolloutPercentage: 50,
    });
    await testFlag.save();

    expect(testFlag._id).toBeDefined();
    expect(testFlag.isOrgTargeted(orgA._id)).toBe(true);
    expect(testFlag.isOrgTargeted(orgB._id)).toBe(false);

    // If org is in both target and excluded, excluded must dominate (deny precedence)
    testFlag.targetOrganizationIds.push(orgB._id);
    expect(testFlag.isOrgTargeted(orgB._id)).toBe(false);
  });

  it("2. GET /settings/flags: Returns list of flags with schema validation and populated organization names", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/settings/flags",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);

    // Check that standard platform flags are seeded and modeled
    const aiFlag = body.data.find((f: any) => f.key === "ai_course_builder");
    expect(aiFlag).toBeDefined();
    expect(aiFlag.name).toBe("AI Course Builder");
    expect(aiFlag.isEnabled).toBeDefined();
    expect(aiFlag.rolloutPercentage).toBeDefined();
    expect(Array.isArray(aiFlag.targetOrganizationIds)).toBe(true);
  });

  it("3. POST /settings/flags: Registers a custom feature flag with audit log", async () => {
    const customKey = `custom_${testPrefix}`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/settings/flags",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        key: customKey,
        name: "Enterprise Custom Gateway",
        description: "Enables dedicated egress VPC peering",
        isEnabled: false,
        environment: "production",
        targetAudience: "organizations",
        targetOrganizationIds: [orgA._id.toString()],
        excludedOrganizationIds: [orgB._id.toString()],
        rolloutPercentage: 0,
        reason: "Enterprise customer request",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.key).toBe(customKey);
    expect(body.data.targetOrganizationIds.length).toBe(1);

    // Verify AuditLog recorded
    const audit = await AuditLog.findOne({
      eventCategory: "feature_flag",
      eventType: "FLAG_UPDATED",
      resourceType: "FeatureFlag",
      resourceId: body.data._id,
    });
    expect(audit).toBeDefined();
    expect(audit?.severity).toBe("warning");
  });

  it("4. PATCH /settings/flags/:key: Updates tenant overrides, rollout %, and logs previous/new state in AuditLog", async () => {
    const customKey = `custom_${testPrefix}`;
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/settings/flags/${customKey}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: true,
        rolloutPercentage: 50,
        targetAudience: "organizations",
        targetOrganizationIds: [orgA._id.toString()],
        excludedOrganizationIds: [orgB._id.toString()],
        reason: `Promoted to beta rollout for ${testPrefix}`,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.data.isEnabled).toBe(true);
    expect(patchBody.data.rolloutPercentage).toBe(50);
    expect(patchBody.data.targetOrganizationIds[0].name).toBe(orgA.name);
    expect(patchBody.data.excludedOrganizationIds[0].name).toBe(orgB.name);

    // Verify AuditLog contains diff
    const log = await AuditLog.findOne({
      eventCategory: "feature_flag",
      eventType: "FLAG_UPDATED",
      description: `Feature flag '${customKey}' updated`,
    }).sort({ createdAt: -1 });

    expect(log).toBeDefined();
    expect(log?.metadata?.previousState).toBeDefined();
    expect(log?.metadata?.newState).toBeDefined();
    expect(log?.metadata?.newState.isEnabled).toBe(true);
    expect(log?.metadata?.newState.rolloutPercentage).toBe(50);
    expect(log?.metadata?.reason).toContain(`Promoted to beta rollout`);
  });

  it("5. Error Handling: Passing invalid organization ObjectId returns HTTP 400", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/settings/flags/ai_course_builder`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        targetOrganizationIds: ["invalid-mongo-id-123"],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("Invalid targetOrganizationId format");
  });

  it("6. Error Handling: Non-existent feature flag returns HTTP 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/settings/flags/non_existent_flag_xyz_999`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        isEnabled: true,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it("7. Security & Authorization: Non-super-admin access is rejected with HTTP 403", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/settings/flags",
      headers: { authorization: `Bearer ${nonAdminToken}` },
    });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${nonAdminToken}` },
      payload: { isEnabled: false },
    });
    expect(patchRes.statusCode).toBe(403);
  });
});
