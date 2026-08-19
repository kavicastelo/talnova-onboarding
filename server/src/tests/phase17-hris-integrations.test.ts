import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import HRISIntegration from "../modules/integrations/models/hris-integration.model.js";
import SyncLog from "../modules/integrations/models/sync-log.model.js";

describe("Phase 17 — HRIS & Enterprise Integrations Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;

  let integrationId: string;

  let otherOrg: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase17-" } });

    // 1. Create Primary Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 17 HRIS Enterprise Org",
      slug: `phase17-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase17-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase17",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 17 Other Org",
      slug: `phase17-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdminToken = app.jwt.sign({
      userId: new mongoose.Types.ObjectId().toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await HRISIntegration.deleteMany({ organizationId: testOrg._id });
      await SyncLog.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Integration Connector Management (INT-001, HRIS-002)", () => {
    it("should create HRIS connector via POST /api/v1/integrations", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integrations",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          provider: "bamboohr",
          name: "BambooHR Production Connector",
          subdomain: "acme-corp",
          apiKey: "bamboo_api_key_123",
          conflictPolicy: "hris_wins",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe("BambooHR Production Connector");

      integrationId = json.data._id;
    });

    it("should test connectivity via POST /api/v1/integrations/:id/test", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/test`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.connected).toBe(true);
    });
  });

  describe("2. Automated Employee Sync & Custom Field Mapping (HRIS-001, INT-003, INT-004)", () => {
    it("should process employee sync batch and auto-provision user via POST /api/v1/integrations/:id/sync", async () => {
      const ts = Date.now();
      const syncEmail = `phase17-employee-${ts}@test.com`;

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          records: [
            {
              work_email: syncEmail,
              first_name: "Christopher",
              last_name: "Sync",
              department: "DevOps Engineering",
              job_title: "DevOps Lead",
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.syncLog.createdUsersCount).toBe(1);

      // Verify user document created in database
      const user = await User.findOne({
        organizationId: testOrg._id,
        "auth.email": syncEmail,
      });
      expect(user).toBeDefined();
      expect(user?.profile.firstName).toBe("Christopher");
      expect(user?.employment.department).toBe("DevOps Engineering");
    });
  });

  describe("3. Webhook Receiver Engine & Inbound Event Sync (INT-002)", () => {
    it("should process inbound HRIS webhook payload via POST /api/v1/integrations/webhooks/bamboohr", async () => {
      const ts = Date.now();
      const webhookEmail = `phase17-webhook-${ts}@test.com`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/integrations/webhooks/bamboohr",
        headers: {
          "x-signature": "dummy_signature",
        },
        payload: {
          employees: [
            {
              work_email: webhookEmail,
              first_name: "Samantha",
              last_name: "Webhook",
              department: "Product Management",
              job_title: "Lead Product Manager",
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const user = await User.findOne({
        organizationId: testOrg._id,
        "auth.email": webhookEmail,
      });
      expect(user).toBeDefined();
      expect(user?.profile.firstName).toBe("Samantha");
    });
  });

  describe("4. Sync Health Telemetry & DLQ Logging (INT-005)", () => {
    it("should retrieve sync history and DLQ logs via GET /api/v1/integrations/:id/logs", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/logs`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should return empty integrations list for Tenant B", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/integrations",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
