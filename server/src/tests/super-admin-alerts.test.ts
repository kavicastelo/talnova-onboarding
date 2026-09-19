import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Alert from "../modules/super-admin/models/alert.model.js";
import AlertService from "../modules/super-admin/services/alert.service.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Super Admin Alerts Suite: SA-ALT-001 Persistent Alert Model & Incident Triage Lifecycle", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `sa-alt-${Date.now()}`;
  const createdAlertIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Baseline Organization
    testOrg = await Organization.create({
      name: `Alert Center Org ${testPrefix}`,
      slug: `alert-org-${testPrefix}`,
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
        email: `alert-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Alert",
        lastName: "Admin",
        fullName: "Alert Admin",
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

    // 3. Create Non-Admin User (Employee)
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `alert-staff-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Alert",
        lastName: "Staff",
        fullName: "Alert Staff",
      },
      employment: {
        department: "Support",
        jobTitle: "Agent",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    nonAdminToken = app.jwt.sign({
      userId: nonAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (createdAlertIds.length > 0) {
      await Alert.deleteMany({ _id: { $in: createdAlertIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
    await app.close();
  });

  describe("1. Alert Model Schema & Auto-Generated Identifiers", () => {
    it("creates an alert with default status 'open' and auto-generated alertNo", async () => {
      const alert = await Alert.create({
        category: "security",
        severity: "critical",
        title: "API Credential Leak Detected",
        description: "Hardcoded API key detected in public repository commit.",
        sourceService: "security-service",
        sourceId: `sec-incident-${Date.now()}`,
        organizationId: testOrg._id,
      });
      createdAlertIds.push(alert._id);

      expect(alert.alertNo).toMatch(/^ALT-\d{4}-\d{6}$/);
      expect(alert.status).toBe("open");
      expect(alert.category).toBe("security");
      expect(alert.severity).toBe("critical");
      expect(alert.acknowledgedBy).toBeUndefined();
      expect(alert.resolvedBy).toBeUndefined();
    });
  });

  describe("2. System Condition Auto-Detection & Synchronization", () => {
    let suspendedOrg: any;

    it("detects suspended tenant and automatically creates persistent critical alert", async () => {
      suspendedOrg = await Organization.create({
        name: `Quarantined Org ${testPrefix}`,
        slug: `quarantined-${testPrefix}`,
        plan: "Enterprise",
        status: "Suspended",
        createdBy: superAdminUser._id,
        isDeleted: false,
      });
      createdOrgIds.push(suspendedOrg._id);

      await AlertService.syncSystemAlerts();

      const alert = await Alert.findOne({
        sourceId: suspendedOrg._id.toString(),
        category: "tenant",
        status: "open",
      });

      expect(alert).not.toBeNull();
      if (alert) {
        createdAlertIds.push(alert._id);
        expect(alert.severity).toBe("critical");
        expect(alert.title).toContain(suspendedOrg.name);
      }
    });

    it("auto-resolves tenant alert when organization condition is reactivated", async () => {
      // Reactivate suspended organization
      await Organization.findByIdAndUpdate(suspendedOrg._id, { status: "Active" });

      await AlertService.syncSystemAlerts();

      const alert = await Alert.findOne({
        sourceId: suspendedOrg._id.toString(),
        category: "tenant",
      });

      expect(alert).not.toBeNull();
      expect(alert?.status).toBe("resolved");
      expect(alert?.resolutionNotes).toContain("Auto-resolved");
    });
  });

  describe("3. GET /api/v1/super-admin/alerts Incident Query & Metrics", () => {
    let testAlert: any;

    beforeAll(async () => {
      testAlert = await Alert.create({
        category: "operations",
        severity: "warning",
        title: `Operations SLA Alert ${testPrefix}`,
        description: "Hardware provisioning task breached 48h SLA window.",
        sourceService: "task-service",
        sourceId: `task-sla-${Date.now()}`,
        organizationId: testOrg._id,
        status: "open",
      });
      createdAlertIds.push(testAlert._id);
    });

    it("returns active alerts with populated organization and live summary statistics", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();

      const { alerts, summary } = json.data;
      expect(Array.isArray(alerts)).toBe(true);
      expect(summary).toBeDefined();
      expect(summary.total).toBeGreaterThanOrEqual(1);
      expect(typeof summary.critical).toBe("number");
      expect(typeof summary.high).toBe("number");
      expect(typeof summary.warning).toBe("number");
      expect(typeof summary.open).toBe("number");

      // Verify populated fields
      const found = alerts.find((a: any) => a.id === testAlert._id.toString());
      expect(found).toBeDefined();
      expect(found.title).toBe(testAlert.title);
      expect(found.status).toBe("open");
      expect(found.organization).toBeDefined();
      expect(found.organization.name).toBe(testOrg.name);
    });

    it("filters alerts by category and severity", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts?category=operations&severity=warning",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      for (const alert of json.data.alerts) {
        expect(alert.category).toBe("operations");
        expect(alert.severity).toBe("warning");
      }
    });
  });

  describe("4. PATCH /api/v1/super-admin/alerts/:id/status Lifecycle State Machine", () => {
    let lifecycleAlert: any;

    beforeAll(async () => {
      lifecycleAlert = await Alert.create({
        category: "onboarding",
        severity: "high",
        title: `Pipeline Failure ${testPrefix}`,
        description: "Automated user SCIM sync timed out after 3 retries.",
        sourceService: "onboarding-service",
        sourceId: `case-${Date.now()}`,
        organizationId: testOrg._id,
        status: "open",
      });
      createdAlertIds.push(lifecycleAlert._id);
    });

    it("transitions alert from 'open' to 'acknowledged' with operator ID and timestamp", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/${lifecycleAlert._id}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "acknowledged" },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("acknowledged");
      expect(json.data.acknowledgedBy).toBe(superAdminUser._id.toString());
      expect(json.data.acknowledgedAt).toBeDefined();

      // Verify database state
      const dbAlert = await Alert.findById(lifecycleAlert._id);
      expect(dbAlert?.status).toBe("acknowledged");
      expect(dbAlert?.acknowledgedBy?.toString()).toBe(superAdminUser._id.toString());
    });

    it("transitions alert to 'investigating'", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/${lifecycleAlert._id}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "investigating" },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("investigating");
    });

    it("transitions alert to 'resolved' with resolutionNotes and archives it from active feed", async () => {
      const notes = "Reset SCIM credentials and successfully re-triggered user provisioning batch.";
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/${lifecycleAlert._id}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          status: "resolved",
          resolutionNotes: notes,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("resolved");
      expect(json.data.resolvedBy).toBe(superAdminUser._id.toString());
      expect(json.data.resolvedAt).toBeDefined();
      expect(json.data.resolutionNotes).toBe(notes);

      // Verify excluded from default active GET /alerts feed
      const activeFeedRes = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      const activeFeed = JSON.parse(activeFeedRes.payload);
      expect(activeFeed.data.alerts.some((a: any) => a.id === lifecycleAlert._id.toString())).toBe(false);

      // Verify present in resolved query (?status=resolved)
      const resolvedFeedRes = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts?status=resolved",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      const resolvedFeed = JSON.parse(resolvedFeedRes.payload);
      expect(resolvedFeed.data.alerts.some((a: any) => a.id === lifecycleAlert._id.toString())).toBe(true);
    });

    it("verifies AuditLog entries were generated for state transitions", async () => {
      const logs = await AuditLog.find({
        resourceType: "Alert",
        resourceId: lifecycleAlert._id,
      });
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((l) => l.eventType === "ALERT_RESOLVED")).toBe(true);
      expect(logs.some((l) => l.eventType === "ALERT_STATUS_CHANGED")).toBe(true);
    });

    it("rejects resolving an already resolved alert with HTTP 400", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/${lifecycleAlert._id}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "resolved" },
      });

      expect(res.statusCode).toBe(400);
      const json = JSON.parse(res.payload);
      expect(json.message).toContain("already resolved");
    });

    it("reopens a resolved alert to 'open' clearing resolution fields", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/${lifecycleAlert._id}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "open" },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.data.status).toBe("open");
      expect(json.data.resolvedBy).toBeUndefined();
      expect(json.data.resolutionNotes).toBeUndefined();
    });
  });

  describe("5. RBAC & Access Control", () => {
    it("rejects non-super-admin employee from GET /alerts with 403", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts",
        headers: { authorization: `Bearer ${nonAdminToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it("rejects non-super-admin employee from PATCH /alerts/:id/status with 403", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/super-admin/alerts/dummy-id/status`,
        headers: { authorization: `Bearer ${nonAdminToken}` },
        payload: { status: "acknowledged" },
      });
      expect(res.statusCode).toBe(403);
    });

    it("rejects unauthenticated caller with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/alerts",
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
