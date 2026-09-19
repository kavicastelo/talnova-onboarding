import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import PlatformSetting from "../modules/super-admin/models/platform-setting.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";

describe("Super Admin Platform Governance Suite: SA-SET-001 Governance Schema & Maintenance Mode Hook", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let tenantUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let tenantToken: string;

  const testPrefix = `sa-set-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdJourneyIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Governance Test Org ${testPrefix}`,
      slug: `gov-org-${testPrefix}`,
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
        email: `gov-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Gov",
        lastName: "Admin",
        fullName: "Gov Admin",
      },
      employment: {
        department: "SecOps",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Create Tenant User (Employee)
    tenantUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `gov-employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Tenant",
        lastName: "Employee",
        fullName: "Tenant Employee",
      },
      employment: {
        department: "Operations",
        jobTitle: "Specialist",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    tenantToken = app.jwt.sign({
      userId: tenantUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create a test Journey for tenant access verification
    const journey = await Journey.create({
      organizationId: testOrg._id,
      title: `Test Journey ${testPrefix}`,
      slug: `test-journey-${testPrefix}`,
      description: "Sample test journey for maintenance checks",
      tags: ["maintenance-check"],
      audience: {},
      modules: [],
      publishing: { status: "published", version: 1 },
      settings: { allowSkipLessons: true, requireSequentialCompletion: false, allowRetakes: true },
      analytics: { totalAssignments: 0, totalCompletions: 0, completionRate: 0, averageScore: 0, averageDurationMinutes: 0 },
      certificate: { enabled: false },
      createdBy: superAdminUser._id,
    });
    createdJourneyIds.push(journey._id);

    // Reset platform setting to normal before tests
    await PlatformSetting.findOneAndUpdate(
      { singleton: true },
      {
        $set: {
          maintenanceMode: false,
          maintenanceMessage: "Talnova Onboarding is undergoing planned infrastructure maintenance.",
          sessionTimeoutMinutes: 60,
          enforceMfaAdmins: true,
        },
      },
      { upsert: true }
    );
  });

  afterAll(async () => {
    // Reset platform setting to maintenanceMode: false
    await PlatformSetting.findOneAndUpdate(
      { singleton: true },
      { $set: { maintenanceMode: false } },
      { upsert: true }
    );

    if (createdJourneyIds.length > 0) {
      await Journey.deleteMany({ _id: { $in: createdJourneyIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (tenantUser) {
      await User.deleteOne({ _id: tenantUser._id });
    }
  });

  describe("1. Platform Governance Schema & Default Configuration", () => {
    it("should retrieve default singleton platform settings via GET /settings/platform", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/settings/platform",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.maintenanceMode).toBe(false);
      expect(body.data.sessionTimeoutMinutes).toBe(60);
      expect(body.data.enforceMfaAdmins).toBe(true);
      expect(body.data.maintenanceMessage).toContain("Talnova Onboarding is undergoing planned infrastructure maintenance.");
    });

    it("should reject updates with sessionTimeoutMinutes < 5 with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/super-admin/settings/platform",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          sessionTimeoutMinutes: 3,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain("Session timeout must be between 5 and 1440 minutes");
    });
  });

  describe("2. Maintenance Mode Activation & Tenant Traffic Interception", () => {
    it("should activate maintenance mode and update parameters via PATCH /settings/platform", async () => {
      const maintenanceMsg = `Platform upgrade in progress for cluster ${testPrefix}`;
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/super-admin/settings/platform",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          maintenanceMode: true,
          maintenanceMessage: maintenanceMsg,
          sessionTimeoutMinutes: 45,
          enforceMfaAdmins: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.maintenanceMode).toBe(true);
      expect(body.data.maintenanceMessage).toBe(maintenanceMsg);
      expect(body.data.sessionTimeoutMinutes).toBe(45);
      expect(body.data.enforceMfaAdmins).toBe(false);

      // Verify persistence in DB
      const dbSetting = await PlatformSetting.findOne({ singleton: true });
      expect(dbSetting?.maintenanceMode).toBe(true);
      expect(dbSetting?.maintenanceMessage).toBe(maintenanceMsg);
    });

    it("should record a PLATFORM_SETTINGS_UPDATED audit log entry with severity critical", async () => {
      const auditEntry = await AuditLog.findOne({
        eventType: "PLATFORM_SETTINGS_UPDATED",
        actorUserId: superAdminUser._id,
      }).sort({ createdAt: -1 });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.severity).toBe("critical");
      expect(auditEntry?.eventCategory).toBe("security");
      expect(auditEntry?.resourceType).toBe("PlatformSetting");
      expect(auditEntry?.metadata?.newState?.maintenanceMode).toBe(true);
    });

    it("should reject tenant request to /api/v1/journeys with HTTP 503 MAINTENANCE_MODE", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
        headers: {
          authorization: `Bearer ${tenantToken}`,
        },
      });

      expect(res.statusCode).toBe(503);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("MAINTENANCE_MODE");
      expect(body.message).toContain(`Platform upgrade in progress for cluster ${testPrefix}`);
    });

    it("should allow Super Admin requests to /api/v1/journeys with HTTP 200 during active maintenance mode", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it("should allow Super Admin to access /api/v1/super-admin/telemetry during active maintenance mode", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/telemetry",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it("should allow infrastructure health probes /live and /health during active maintenance mode", async () => {
      const liveRes = await app.inject({
        method: "GET",
        url: "/live",
      });
      expect(liveRes.statusCode).toBe(200);

      const healthRes = await app.inject({
        method: "GET",
        url: "/health",
      });
      expect(healthRes.statusCode).toBe(200);
    });
  });

  describe("3. Deactivation & Restoration of Tenant Access", () => {
    it("should deactivate maintenance mode via PATCH /settings/platform", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/super-admin/settings/platform",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          maintenanceMode: false,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.maintenanceMode).toBe(false);

      const dbSetting = await PlatformSetting.findOne({ singleton: true });
      expect(dbSetting?.maintenanceMode).toBe(false);
    });

    it("should immediately restore HTTP 200 for tenant requests to /api/v1/journeys without server restart", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
        headers: {
          authorization: `Bearer ${tenantToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
    });
  });

  describe("4. Security & Role-Based Access Control", () => {
    it("should reject unauthenticated requests to /settings/platform with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/settings/platform",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject non-super-admin requests to /settings/platform with 403", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/super-admin/settings/platform",
        headers: {
          authorization: `Bearer ${tenantToken}`,
        },
        payload: {
          maintenanceMode: true,
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
