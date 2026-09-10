import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { HRISIntegration, Integration } from "../modules/integrations/models/hris-integration.model.js";
import SyncLog from "../modules/integrations/models/sync-log.model.js";

describe("Journey Test UJ-ADM-011: HRIS Marketplace Integration Sync", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Acme HRIS Test Org",
      slug: `acme-hris-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin user (manage_integrations capability)
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `hr-admin-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "HR",
        lastName: "Administrator",
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

    // 3. Create regular Employee user (no manage_integrations capability)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `staff-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Staff",
        lastName: "Member",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await HRISIntegration.deleteMany({ organizationId: testOrg._id });
      await SyncLog.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 1-6: Admin connects BambooHR with Subdomain and API Key", async () => {
    const payload = {
      subdomain: "acmetest",
      apiKey: "test_api_key_123",
      name: "BambooHR Production Sync",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/bamboohr/connect",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe("bamboohr");
    expect(body.data.subdomain).toBe("acmetest");
    expect(body.data.status).toBe("active");
    expect(body.data.apiKey).toBe("test_api_key_123");
  });

  it("Step 7-8: Admin triggers workforce sync and receives queued status", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/bamboohr/sync",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.status).toBe("queued");
    expect(body.syncId).toBeDefined();
    expect(typeof body.syncId).toBe("string");
  });

  it("Data Integrity Check: MongoDB Integration document stores tenant ID and credentials", async () => {
    const integrationDoc = await Integration.findOne({
      organizationId: testOrg._id,
      provider: "bamboohr",
    });

    expect(integrationDoc).not.toBeNull();
    expect(integrationDoc?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(integrationDoc?.status).toBe("active");
    expect(integrationDoc?.subdomain).toBe("acmetest");
    expect(integrationDoc?.apiKey).toBe("test_api_key_123");
    expect(integrationDoc?.lastSyncedAt).toBeDefined();
  });

  it("Integration Check: Incoming webhook endpoint processes BambooHR payload", async () => {
    const webhookPayload = {
      employees: [
        {
          work_email: `bamboo-hook-${Date.now()}@acme.corp`,
          first_name: "Bamboo",
          last_name: "Employee",
          department: "People Operations",
          job_title: "HR Specialist",
        },
      ],
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/webhooks/bamboohr",
      payload: webhookPayload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.syncLog).toBeDefined();
    expect(body.data.syncLog.createdUsersCount).toBeGreaterThanOrEqual(1);

    // Verify user was provisioned in User collection
    const provisionedUser = await User.findOne({
      organizationId: testOrg._id,
      "auth.email": webhookPayload.employees[0].work_email,
    });
    expect(provisionedUser).not.toBeNull();
    expect(provisionedUser?.profile.firstName).toBe("Bamboo");
    expect(provisionedUser?.employment?.department).toBe("People Operations");
  });

  it("Alternative Path: Admin can disconnect BambooHR connector", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/bamboohr/disconnect",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const integrationDoc = await Integration.findOne({
      organizationId: testOrg._id,
      provider: "bamboohr",
    });
    expect(integrationDoc?.status).toBe("disabled");
  });

  it("Negative Test: Connecting with empty API key returns 400 Bad Request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/bamboohr/connect",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      payload: {
        subdomain: "acmetest",
        apiKey: "",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/api key.*required/i);
  });

  it("Authorization Test: Regular employees calling POST /api/v1/integrations/* receive 403 Forbidden", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/bamboohr/connect",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        subdomain: "hack",
        apiKey: "hack_key",
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });
});
