import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";
import { SuperAdminService } from "../modules/super-admin/services/super-admin.service.js";
import { DEFAULT_PLATFORM_FLAGS } from "../modules/super-admin/config/default-feature-flags.js";

describe("PR-GOV-001: Master Feature Registry Expansion to 105 Capabilities", () => {
  let app: FastifyInstance;
  let superAdminService: SuperAdminService;
  let testOrg: any;
  let superAdminUser: any;
  let superAdminToken: string;

  const testPrefix = `gov-seed-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    superAdminService = new SuperAdminService();

    // Create test organization & super admin for API assertions
    const dummyId = new mongoose.Types.ObjectId();
    testOrg = await Organization.create({
      name: `Gov Seed Org ${testPrefix}`,
      slug: `gov-seed-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    superAdminUser = await User.create({
      organizationId: testOrg._id,
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
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: testOrg._id });
    await User.deleteMany({ _id: superAdminUser._id });
    await app.close();
  });

  it("1. Verifies DEFAULT_PLATFORM_FLAGS catalog contains exactly 105 capabilities", () => {
    expect(DEFAULT_PLATFORM_FLAGS.length).toBe(105);

    // Verify all keys are non-empty and unique
    const keys = DEFAULT_PLATFORM_FLAGS.map((f) => f.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(105);
  });

  it("2. Wipes collection and seeds all 105 capabilities idempotently", async () => {
    // 1. Wipe feature_flags collection in test database
    await FeatureFlag.deleteMany({});
    const initialCount = await FeatureFlag.countDocuments({ isDeleted: false });
    expect(initialCount).toBe(0);

    // 2. Invoke superAdminService.syncDefaultFeatureFlags()
    await superAdminService.syncDefaultFeatureFlags();

    // 3. Query FeatureFlag.countDocuments({ isDeleted: false })
    const count = await FeatureFlag.countDocuments({ isDeleted: false });

    // 4. Assert count equals 105
    expect(count).toBe(105);

    // 5. Verify specific canonical keys exist
    const specificKeys = [
      "digital_signatures",
      "kiosk_mode",
      "office_map",
      "sso_enforcement",
      "journey_templates",
      "workflow_rules",
      "milestone_ratings",
      "buddy_connection",
      "calendar_integration",
      "gamified_milestones",
      "checklist_tasks",
    ];

    for (const key of specificKeys) {
      const doc = await FeatureFlag.findOne({ key, isDeleted: false });
      expect(doc, `Expected key '${key}' to exist in feature_flags`).not.toBeNull();
      expect(doc?.key).toBe(key);
      expect(doc?.name).toBeTruthy();
      expect(doc?.description).toBeTruthy();
    }
  });

  it("3. Preserves administrative overrides on subsequent sync cycles (Idempotency)", async () => {
    // 6. Modify an existing flag (e.g. digital_signatures custom rollout and excluded org)
    const targetKey = "digital_signatures";
    const customOrgId = new mongoose.Types.ObjectId();

    await FeatureFlag.updateOne(
      { key: targetKey },
      {
        $set: {
          isEnabled: false,
          description: "Custom admin overridden description",
          rolloutPercentage: 42,
          excludedOrganizationIds: [customOrgId],
        },
      }
    );

    // Verify change took effect in database
    const modifiedBeforeSync = await FeatureFlag.findOne({ key: targetKey });
    expect(modifiedBeforeSync?.isEnabled).toBe(false);
    expect(modifiedBeforeSync?.rolloutPercentage).toBe(42);
    expect(modifiedBeforeSync?.description).toBe("Custom admin overridden description");
    expect(modifiedBeforeSync?.excludedOrganizationIds).toContainEqual(customOrgId);

    // Re-run syncDefaultFeatureFlags()
    await superAdminService.syncDefaultFeatureFlags();

    // Assert count remains 105
    const countAfterSync = await FeatureFlag.countDocuments({ isDeleted: false });
    expect(countAfterSync).toBe(105);

    // Assert admin changes were preserved by $setOnInsert
    const modifiedAfterSync = await FeatureFlag.findOne({ key: targetKey });
    expect(modifiedAfterSync?.isEnabled).toBe(false);
    expect(modifiedAfterSync?.rolloutPercentage).toBe(42);
    expect(modifiedAfterSync?.description).toBe("Custom admin overridden description");
    expect(modifiedAfterSync?.excludedOrganizationIds).toContainEqual(customOrgId);
  });

  it("4. GET /api/v1/super-admin/settings/flags returns the full 105-flag catalog", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/settings/flags",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(105);

    // Spot-check items from various domains
    const returnedKeys = body.data.map((f: any) => f.key);
    expect(returnedKeys).toContain("auth_credentials");
    expect(returnedKeys).toContain("digital_signatures");
    expect(returnedKeys).toContain("kiosk_mode");
    expect(returnedKeys).toContain("office_map");
    expect(returnedKeys).toContain("sso_enforcement");
    expect(returnedKeys).toContain("onboarding_funnels");
  });
});
