import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { EmailService } from "../shared/email/email.service.js";

describe("Tenant Provisioning & Bulk Employee Import: Credentials & First-Login Security", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;

  const testPrefix = `prov-auth-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Core Cluster ${testPrefix}`,
      slug: `core-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `root-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Root",
        lastName: "Admin",
        fullName: "Root Admin",
      },
      employment: {
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
      roles: ["super_admin"],
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ "auth.email": { $regex: testPrefix } });
    await Organization.deleteMany({ slug: { $regex: testPrefix } });
    await app.close();
  });

  it("1. Super Admin provisions a tenant: auto-generates secure password, activation token, and dispatches email", async () => {
    const tenantEmail = `owner-${testPrefix}@newtenant.test`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/organizations",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: `Acme Innovations ${testPrefix}`,
        domain: `acme-${testPrefix}.test`,
        slug: `acme-inno-${testPrefix}`,
        adminEmail: tenantEmail,
        plan: "Enterprise",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.credentials).toBeDefined();
    expect(body.data.credentials.email).toBe(tenantEmail);
    expect(body.data.credentials.temporaryPassword).toMatch(/^Talnova-[A-F0-9]{6}!26$/);
    expect(body.data.credentials.activationUrl).toContain("token=");
    expect(body.data.credentials.mustChangePassword).toBe(true);
    expect(body.data.credentials.emailDispatched).toBe(true);

    // Verify DB user record
    const ownerUser = await User.findOne({ "auth.email": tenantEmail });
    expect(ownerUser).toBeTruthy();
    expect(ownerUser?.security?.mustChangePassword).toBe(true);
    expect(ownerUser?.security?.passwordResetToken).toBeDefined();
    expect(ownerUser?.security?.passwordResetExpires).toBeDefined();

    // Verify welcome email dispatched
    const sentEmail = EmailService.sentEmails.find(e => e.to === tenantEmail);
    expect(sentEmail).toBeDefined();
  });

  it("2. Super Admin provisions a tenant with custom initial password: preserves custom password & enforces first-login reset", async () => {
    const tenantEmail = `custom-owner-${testPrefix}@customtenant.test`;
    const customPassword = "CustomSecurePassword2026!";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/organizations",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: `Custom Tech ${testPrefix}`,
        domain: `custom-${testPrefix}.test`,
        slug: `custom-${testPrefix}`,
        adminEmail: tenantEmail,
        plan: "Growth",
        initialPassword: customPassword,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.credentials.temporaryPassword).toBe(customPassword);
    expect(body.data.credentials.mustChangePassword).toBe(true);

    // Login with this custom password
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: tenantEmail,
        password: customPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json();
    expect(loginBody.data.user.mustChangePassword).toBe(true);
    const ownerToken = loginBody.data.accessToken;

    // Change password via /change-password
    const newPassword = "NewStrongPassword2026!#";
    const changeRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/change-password",
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
      payload: {
        currentPassword: customPassword,
        newPassword,
      },
    });

    expect(changeRes.statusCode).toBe(200);
    expect(changeRes.json().success).toBe(true);

    // Verify in DB that mustChangePassword is now false
    const updatedOwner = await User.findOne({ "auth.email": tenantEmail });
    expect(updatedOwner?.security?.mustChangePassword).toBe(false);

    // Login with new password -> mustChangePassword is now false
    const loginRes2 = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: tenantEmail,
        password: newPassword,
      },
    });
    expect(loginRes2.statusCode).toBe(200);
    expect(loginRes2.json().data.user.mustChangePassword).toBe(false);
  });

  it("3. Bulk Employee Import: flags imported accounts with mustChangePassword = true and returns default credentials", async () => {
    const empEmail1 = `emp1-${testPrefix}@talnova.test`;
    const empEmail2 = `emp2-${testPrefix}@talnova.test`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        users: [
          {
            email: empEmail1,
            firstName: "Alice",
            lastName: "Smith",
            role: "employee",
          },
          {
            email: empEmail2,
            firstName: "Bob",
            lastName: "Jones",
            role: "employee",
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.defaultCredentials).toBeDefined();
    expect(body.data.defaultCredentials.temporaryPassword).toBe("Welcome@2026!");
    expect(body.data.defaultCredentials.mustChangePassword).toBe(true);

    // Check newly imported user in DB
    const emp1 = await User.findOne({ "auth.email": empEmail1 });
    expect(emp1).toBeTruthy();
    expect(emp1?.security?.mustChangePassword).toBe(true);

    // Login as imported user using default password
    const empLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: empEmail1,
        password: "Welcome@2026!",
      },
    });

    expect(empLogin.statusCode).toBe(200);
    const empLoginBody = empLogin.json();
    expect(empLoginBody.data.user.mustChangePassword).toBe(true);
  });
});
