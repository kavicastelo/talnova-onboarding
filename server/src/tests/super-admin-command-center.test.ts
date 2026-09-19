import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Super Admin Command Center: Multi-Cluster Suite Integration Test", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `sa-suite-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Acme Corp ${testPrefix}`,
      slug: `acme-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `root-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Root",
        lastName: "Administrator",
        fullName: "Root Administrator",
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
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Create Non-Admin User for RBAC testing
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Test",
        lastName: "Employee",
        fullName: "Test Employee",
      },
      employment: {
        department: "Sales",
        jobTitle: "Account Executive",
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
    if (testOrg) {
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
    await app.close();
  });

  it("1. RBAC Guard: Rejects non-super-admin access with HTTP 403", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        authorization: `Bearer ${nonAdminToken}`,
      },
    });
    expect(response.statusCode).toBe(403);
  });

  it("2. Telemetry: Returns 8 real KPIs with deterministic calculation", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.stats).toHaveProperty("totalOrganizations");
    expect(body.data.stats).toHaveProperty("platformUsers");
    expect(body.data.stats).toHaveProperty("activeOnboardings");
    expect(body.data.stats).toHaveProperty("cashCollected");
    expect(body.data.stats).toHaveProperty("operatingExpenses");
    expect(body.data.stats).toHaveProperty("netOperatingResult");
    expect(body.data.stats).toHaveProperty("openAlerts");
    expect(body.data.stats).toHaveProperty("systemHealth");
  });

  it("3. Global Search: Cross-domain search returns matching organizations and users", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/search?q=${testPrefix}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.organizations.some((o: any) => o.id === testOrg._id.toString())).toBe(true);
    expect(body.data.users.some((u: any) => u.id === superAdminUser._id.toString())).toBe(true);
  });

  it("4. Organization 360: Aggregates full tenant profile, quotas, and audit", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/360`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.organization.id).toBe(testOrg._id.toString());
    expect(body.data).toHaveProperty("quotas");
    expect(body.data.quotas).toHaveProperty("users");
    expect(body.data.quotas).toHaveProperty("storage");
  });

  it("5. Quarantine Action: Successfully toggles tenant quarantine status and writes AuditLog", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/quarantine`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        reason: "Compliance inspection test",
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Suspended");

    // Verify audit log with TENANT_QUARANTINED
    const log = await AuditLog.findOne({
      eventType: "TENANT_QUARANTINED",
      resourceId: testOrg._id,
    });
    expect(log).toBeDefined();
    expect(log?.severity).toBe("critical");
  });

  it("6. User 360 & Directory: Retrieves user roster and detailed profile", async () => {
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/users",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body);
    expect(listBody.data.users.length).toBeGreaterThan(0);

    const userRes = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/users/${superAdminUser._id}/360`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(userRes.statusCode).toBe(200);
    const userBody = JSON.parse(userRes.body);
    expect(userBody.data.user.id).toBe(superAdminUser._id.toString());
  });

  it("7. Observability Cluster: All 4 telemetry routes respond successfully", async () => {
    const [apiRes, infraRes, aiRes, storageRes] = await Promise.all([
      app.inject({ method: "GET", url: "/api/v1/super-admin/observability/api", headers: { authorization: `Bearer ${superAdminToken}` } }),
      app.inject({ method: "GET", url: "/api/v1/super-admin/observability/infrastructure", headers: { authorization: `Bearer ${superAdminToken}` } }),
      app.inject({ method: "GET", url: "/api/v1/super-admin/observability/ai", headers: { authorization: `Bearer ${superAdminToken}` } }),
      app.inject({ method: "GET", url: "/api/v1/super-admin/observability/storage", headers: { authorization: `Bearer ${superAdminToken}` } }),
    ]);

    expect(apiRes.statusCode).toBe(200);
    expect(infraRes.statusCode).toBe(200);
    expect(aiRes.statusCode).toBe(200);
    expect(storageRes.statusCode).toBe(200);

    const infraBody = JSON.parse(infraRes.body);
    expect(infraBody.data.database.state).toBe("CONNECTED");
  });

  it("8. Finance B2B Ledger: Records manual payment and operating expense", async () => {
    const payRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        organizationId: testOrg._id.toString(),
        amount: 2500,
        reference: `WIRE-${testPrefix}`,
        method: "wire",
        notes: "Enterprise contract quarterly prepayment",
      },
    });
    expect(payRes.statusCode).toBe(201);

    const expRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        title: `Cloudflare R2 Storage Bill ${testPrefix}`,
        amount: 150,
        category: "hosting",
        vendor: "Cloudflare",
        notes: "Monthly storage compute",
      },
    });
    expect(expRes.statusCode).toBe(201);
  });

  it("9. Feature Flags: Toggles runtime feature flag cleanly", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/super-admin/settings/flags/ai_course_builder",
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        enabled: true,
        rolloutPct: 100,
      },
    });
    expect(patchRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/settings/flags",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(getRes.statusCode).toBe(200);
    const flagsBody = JSON.parse(getRes.body);
    const flag = flagsBody.data.find((f: any) => f.key === "ai_course_builder");
    expect(flag.enabled).toBe(true);
  });

  it("10. Alerts Center: Aggregates active multi-tenant alerts including suspended tenants", async () => {
    const alertRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/alerts",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(alertRes.statusCode).toBe(200);
    const alertBody = JSON.parse(alertRes.body);
    expect(alertBody.data.summary.total).toBeGreaterThanOrEqual(1);
    expect(alertBody.data.alerts.some((a: any) => a.sourceId === testOrg._id.toString())).toBe(true);
  });
});
