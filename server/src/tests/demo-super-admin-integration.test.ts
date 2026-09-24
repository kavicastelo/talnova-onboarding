import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import { hashPassword } from "../utils/crypto.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoRiskAlertModel,
} from "../modules/demo/models/index.js";

describe("Super Admin Dashboard — Demo Management API Integration", () => {
  let app: any;
  let superAdminToken: string;
  let regularEmployeeToken: string;
  let superAdminUser: any;
  let regularUser: any;
  let platformOrg: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    platformOrg = await Organization.create({
      name: "Platform Management HQ",
      slug: `platform-hq-${Date.now()}`,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    const passHash = await hashPassword("AdminPass123!");

    // 1. Super Admin User
    superAdminUser = await User.create({
      organizationId: platformOrg._id,
      auth: {
        email: `superadmin-${Date.now()}@platform.com`,
        passwordHash: passHash,
      },
      profile: { firstName: "Chief", lastName: "Admin", fullName: "Chief Admin" },
      permissions: { role: "super_admin", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    // 2. Regular Employee User
    regularUser = await User.create({
      organizationId: platformOrg._id,
      auth: {
        email: `employee-${Date.now()}@platform.com`,
        passwordHash: passHash,
      },
      profile: { firstName: "Regular", lastName: "Staff", fullName: "Regular Staff" },
      permissions: { role: "employee", customRoles: [] },
      employment: { employmentType: "full_time", status: "active" },
    });

    // Obtain tokens
    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: platformOrg._id.toString(),
      role: "super_admin",
      tokenVersion: 1,
    });

    regularEmployeeToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      organizationId: platformOrg._id.toString(),
      role: "employee",
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await Organization.deleteOne({ _id: platformOrg._id });
    await User.deleteMany({ _id: { $in: [superAdminUser._id, regularUser._id] } });
    await closeDemoConnection(app.log);
    await disconnectDatabase(app.log);
  });

  it("1. Blocks non-super-admin from demo management routes with 403 FORBIDDEN", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/demo/overview",
      headers: { Authorization: `Bearer ${regularEmployeeToken}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
  });

  it("2. Returns overview telemetry for Super Admin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/demo/overview",
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.tenantsCount).toBeDefined();
    expect(body.data.activeUsersCount).toBeDefined();
    expect(body.data.watermarkEnabled).toBe(true);
  });

  it("3. Provisions a new demo company from Super Admin Dashboard", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/demo/companies",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: "Initech Logistics Demo",
        slug: `initech-logistics-${Date.now()}`,
        domain: "initech-demo.com",
        contactEmail: "admin@initech-demo.com",
        entitlementPackage: "FULL_SUITE",
        durationDays: 14,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.name).toBe("Initech Logistics Demo");
    expect(body.data.entitlementPackage).toBe("FULL_SUITE");
    expect(body.data.allowedFeatures.length).toBeGreaterThan(5);
  });

  it("4. Creates an attributable demo user under a company", async () => {
    const DemoTenant = getDemoTenantModel();
    const tenant = await DemoTenant.findOne({ slug: "acme-corp-demo" });
    expect(tenant).toBeDefined();

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/demo/users",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: {
        demoTenantId: tenant!._id.toString(),
        email: `super-admin-created-${Date.now()}@acme-demo.com`,
        fullName: "Attributable Demo Member",
        role: "demo_employee",
        department: "Product Design",
        jobTitle: "UI/UX Designer",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.fullName).toBe("Attributable Demo Member");
    expect(body.data.companyName).toBe(tenant!.name);
  });

  it("5. Terminates an active demo session from Super Admin", async () => {
    const DemoUser = getDemoUserModel();
    const DemoSession = getDemoSessionModel();
    const user = await DemoUser.findOne();

    const sessionId = `admin-term-session-${Date.now()}`;
    await DemoSession.create({
      sessionId,
      demoUserId: user!._id,
      demoTenantId: user!.demoTenantId,
      isValid: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/demo/sessions/${sessionId}/terminate`,
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const sessionRecord = await DemoSession.findOne({ sessionId });
    expect(sessionRecord?.isValid).toBe(false);
    expect(sessionRecord?.suspiciousReason).toContain("Terminated by");
  });

  it("6. Super Admin triggers demo reset requiring 'RESET DEMO' confirmation", async () => {
    // 1. Without confirmation key -> must fail
    const failRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/demo/reset",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: { confirmText: "invalid text" },
    });
    expect(failRes.statusCode).toBe(400);

    // 2. With exact key -> executes 10-step reset
    const successRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/demo/reset",
      headers: { Authorization: `Bearer ${superAdminToken}` },
      payload: { confirmText: "RESET DEMO" },
    });
    expect(successRes.statusCode).toBe(200);
    const body = successRes.json();
    expect(body.success).toBe(true);
    expect(body.data.stepsCompleted.length).toBe(10);
    expect(body.data.stats.tenantsCreated).toBeGreaterThanOrEqual(2);
  });
});
