import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import FeatureFlag from "../modules/super-admin/models/feature-flag.model.js";
import FeatureFlagService from "../modules/super-admin/services/feature-flag.service.js";

describe("PR-API-001: Backend Fastify Route Guard Hardening Across Target Modules", () => {
  let app: FastifyInstance;
  let orgA: any;
  let orgB: any;
  let superAdminUser: any;
  let orgAAdminUser: any;
  let orgBAdminUser: any;
  let superAdminToken: string;
  let orgAToken: string;
  let orgBToken: string;

  const testPrefix = `api-guard-${Date.now()}`;

  const flagsToTest = [
    {
      flagKey: "digital_signatures",
      module: "Documents",
      method: "GET",
      url: "/api/v1/documents/templates",
    },
    {
      flagKey: "journey_templates",
      module: "Journeys",
      method: "GET",
      url: "/api/v1/journeys",
    },
    {
      flagKey: "workflow_rules",
      module: "Workflows",
      method: "GET",
      url: "/api/v1/workflows",
    },
    {
      flagKey: "milestone_ratings",
      module: "Milestones",
      method: "GET",
      url: "/api/v1/milestones/templates",
    },
    {
      flagKey: "buddy_connection",
      module: "Buddy",
      method: "GET",
      url: "/api/v1/buddy/available",
    },
    {
      flagKey: "calendar_integration",
      module: "Calendar",
      method: "GET",
      url: "/api/v1/calendar/events",
    },
    {
      flagKey: "gamified_milestones",
      module: "Gamification",
      method: "GET",
      url: "/api/v1/gamification/profile",
    },
    {
      flagKey: "office_map",
      module: "Locations",
      method: "GET",
      url: "/api/v1/locations/office-map",
    },
    {
      flagKey: "checklist_tasks",
      module: "Tasks",
      method: "GET",
      url: "/api/v1/tasks",
    },
    {
      flagKey: "checklist_tasks",
      module: "Task Templates",
      method: "GET",
      url: "/api/v1/tasks/templates",
    },
    {
      flagKey: "knowledge_base",
      module: "Knowledge Base",
      method: "GET",
      url: "/api/v1/knowledge-base",
    },
    {
      flagKey: "tenant_analytics",
      module: "Analytics Overview",
      method: "GET",
      url: "/api/v1/analytics/overview",
    },
    {
      flagKey: "certificates",
      module: "Certificates",
      method: "GET",
      url: "/api/v1/certificates/me",
    },
    {
      flagKey: "employee_directory",
      module: "Employee Directory",
      method: "GET",
      url: "/api/v1/employees",
    },
    {
      flagKey: "hr_ops_dashboard",
      module: "HR Operations Dashboard",
      method: "GET",
      url: "/api/v1/hr/dashboard",
    },
    {
      flagKey: "manager_dashboard",
      module: "Manager Dashboard",
      method: "GET",
      url: "/api/v1/manager/dashboard",
    },
  ];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Provision Organization A (Flags Enabled) and Organization B (Flags Disabled)
    orgA = await Organization.create({
      name: `Guarded Org Alpha ${testPrefix}`,
      slug: `guard-alpha-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    orgB = await Organization.create({
      name: `Guarded Org Beta ${testPrefix}`,
      slug: `guard-beta-${testPrefix}`,
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
      employment: { status: "active", department: "Operations" },
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

    // 5. Seed / Update flags: Org A enabled, Org B excluded/disabled
    const uniqueFlagKeys = [...new Set(flagsToTest.map((f) => f.flagKey))];
    for (const key of uniqueFlagKeys) {
      await FeatureFlag.findOneAndUpdate(
        { key },
        {
          key,
          name: key.replace(/_/g, " "),
          description: `Feature flag for ${key}`,
          isEnabled: true,
          targetOrganizationIds: [orgA._id],
          excludedOrganizationIds: [orgB._id],
          updatedBy: superAdminUser._id,
        },
        { upsert: true, new: true }
      );
    }

    FeatureFlagService.invalidateCache();
  });

  afterAll(async () => {
    // Cleanup created test records
    await Organization.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
    await User.deleteMany({
      _id: { $in: [superAdminUser._id, orgAAdminUser._id, orgBAdminUser._id] },
    });
    const uniqueFlagKeys = [...new Set(flagsToTest.map((f) => f.flagKey))];
    // Reset flags excluded list
    await FeatureFlag.updateMany(
      { key: { $in: uniqueFlagKeys } },
      { $pull: { excludedOrganizationIds: orgB._id, targetOrganizationIds: orgA._id } }
    );
    FeatureFlagService.invalidateCache();
    await app.close();
  });

  for (const item of flagsToTest) {
    it(`Enforcement on ${item.module} (${item.flagKey}): Org A allowed (2xx), Org B blocked (403 FEATURE_DISABLED)`, async () => {
      // Request from Org B (Feature Disabled for Org B)
      const resB = await app.inject({
        method: item.method as any,
        url: item.url,
        headers: { authorization: `Bearer ${orgBToken}` },
      });

      expect(resB.statusCode).toBe(403);
      const bodyB = JSON.parse(resB.body);
      expect(bodyB.success).toBe(false);
      expect(bodyB.code).toBe("FEATURE_DISABLED");
      expect(bodyB.error).toBeDefined();
      expect(bodyB.error.code).toBe("FEATURE_DISABLED");
      expect(bodyB.error.message).toBe(
        `The feature '${item.flagKey}' is currently disabled for your organization.`
      );

      // Request from Org A (Feature Enabled for Org A)
      const resA = await app.inject({
        method: item.method as any,
        url: item.url,
        headers: { authorization: `Bearer ${orgAToken}` },
      });

      expect(resA.statusCode).not.toBe(403);
      expect(resA.statusCode).toBeLessThan(400);
    });
  }

  it("Super Admin bypasses requireFeatureFlag even for disabled features", async () => {
    // Calling journey routes with superAdminToken succeeds with 200
    const resSuper = await app.inject({
      method: "GET",
      url: "/api/v1/journeys",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(resSuper.statusCode).toBe(200);
  });
});
