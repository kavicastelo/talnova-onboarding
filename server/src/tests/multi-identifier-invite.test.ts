import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { FastifyInstance } from "fastify";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { hashPassword } from "../utils/crypto.js";

describe("Phase 3 — Single Employee Invite & Creation Flow (Multi-Identifier)", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let kioskDevice: any;

  const ts = Date.now();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization without configured email
    testOrg = await Organization.create({
      name: `Multi-ID Invite Test Org ${ts}`,
      slug: `multi-id-invite-${ts}`,
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
    });

    const passwordHash = await hashPassword("AdminSecret123!");

    // 2. Create Org Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-invite-${ts}@test.com`,
        passwordHash,
        emailVerified: true,
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
      },
      employment: {
        employeeId: `ADMIN-EMP-${ts}`,
        status: "active",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      email: adminUser.auth.email!,
      organizationId: testOrg._id.toString(),
      role: "admin",
      roles: ["admin"],
    });

    // 3. Create Paired Kiosk Device for terminal checks
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      name: "Frontline Warehouse Terminal",
      deviceId: `DEV-INVITE-${ts}`,
      hardwareGuid: `HW-GUID-${ts}`,
      location: "Warehouse Bay 1",
      status: "online",
      lastHeartbeatAt: new Date(),
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  it("1. should invite an employee with email and optional employeeId", async () => {
    const customEmpId = `GW-${ts}-001`;
    const inviteEmail = `jack.groundworker.${ts}@test.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "Jack",
        lastName: "GroundWorker",
        email: inviteEmail,
        employeeId: customEmpId,
        department: "Logistics",
        role: "employee",
        initialPassword: "WorkerPassword123!",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.message).toBe("Employee invited successfully");
    expect(body.data.employment.employeeId).toBe(customEmpId);
    expect(body.data.auth?.email).toBe(inviteEmail);
    expect(body.data.temporaryPassword).toBe("WorkerPassword123!");

    // Verify worker can authenticate on web login using either Employee ID or Email
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: customEmpId,
        password: "WorkerPassword123!",
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginBody = JSON.parse(loginRes.payload);
    expect(loginBody.success).toBe(true);
    expect(loginBody.data.user.id).toBe(body.data._id.toString());

    // Verify worker can be identified on Kiosk terminal using Employee ID
    const kioskRes = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: customEmpId,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(kioskRes.statusCode).toBe(200);
    const kioskBody = JSON.parse(kioskRes.payload);
    expect(kioskBody.success).toBe(true);
    expect(kioskBody.data.worker.id).toBe(body.data._id.toString());
  });

  it("2. should invite an employee with email and phone (phone provided, employeeId auto-provisioned or optional)", async () => {
    const workerPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
    const inviteEmail = `maria.phone.${ts}@test.com`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "Maria",
        lastName: "PhoneWorker",
        email: inviteEmail,
        phone: workerPhone,
        department: "Operations",
        role: "employee",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.auth.email).toBe(inviteEmail);
    expect(body.data.profile.phone).toBe(workerPhone);
    expect(body.data.temporaryPassword).toBeDefined();

    const tempPassword = body.data.temporaryPassword;

    // Verify worker can login with Phone Number
    const loginWithPhoneRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: workerPhone,
        password: tempPassword,
      },
    });
    expect(loginWithPhoneRes.statusCode).toBe(200);

    // Verify worker can login with Email
    const loginWithEmailRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: inviteEmail,
        password: tempPassword,
      },
    });
    expect(loginWithEmailRes.statusCode).toBe(200);

    // Verify worker can identify on Kiosk terminal with Phone
    const kioskPhoneRes = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: workerPhone,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });
    expect(kioskPhoneRes.statusCode).toBe(200);
  });

  it("3. should reject invitation when email is omitted (Email is strictly required for employee invitations)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "Missing",
        lastName: "Email",
        employeeId: `NO-EMAIL-${ts}`,
        department: "General",
        role: "employee",
      },
    });

    expect([400, 422]).toContain(res.statusCode);
  });

  it("4. should reject duplicate employeeId within the same organization", async () => {
    const duplicateEmpId = `DUP-EMP-${ts}`;
    const email1 = `holder1.${ts}@test.com`;
    const email2 = `holder2.${ts}@test.com`;

    // Create first employee with this employeeId
    const firstRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "First",
        lastName: "Holder",
        email: email1,
        employeeId: duplicateEmpId,
        department: "General",
        role: "employee",
      },
    });
    expect(firstRes.statusCode).toBe(201);

    // Attempt second employee with duplicate employeeId
    const secondRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "Second",
        lastName: "Holder",
        email: email2,
        employeeId: duplicateEmpId,
        department: "General",
        role: "employee",
      },
    });

    expect(secondRes.statusCode).toBe(409);
    const body = JSON.parse(secondRes.payload);
    expect(body.code).toBe("CONFLICT");
  });

  it("5. should reject duplicate phone within the same organization", async () => {
    const duplicatePhone = `+1999${Math.floor(1000000 + Math.random() * 9000000)}`;
    const email1 = `phone1.${ts}@test.com`;
    const email2 = `phone2.${ts}@test.com`;

    const firstRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "PhoneHolder1",
        lastName: "Test",
        email: email1,
        phone: duplicatePhone,
        department: "General",
        role: "employee",
      },
    });
    expect(firstRes.statusCode).toBe(201);

    const secondRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        firstName: "PhoneHolder2",
        lastName: "Test",
        email: email2,
        phone: duplicatePhone,
        department: "General",
        role: "employee",
      },
    });

    expect(secondRes.statusCode).toBe(409);
    const body = JSON.parse(secondRes.payload);
    expect(body.code).toBe("CONFLICT");
  });

  it("6. should update employee phone, employeeId, and badgeId via PATCH /employees/:id", async () => {
    const createdWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        passwordHash: await hashPassword("ValidPassword123!"),
      },
      profile: {
        firstName: "Updatable",
        lastName: "Worker",
      },
      employment: {
        employeeId: `OLD-ID-${ts}`,
        status: "active",
      },
      permissions: { role: "employee" },
    });

    const newEmpId = `NEW-ID-${ts}`;
    const newPhone = `+1888${Math.floor(1000000 + Math.random() * 9000000)}`;
    const newBadge = `RFID-BADGE-${ts}`;

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/employees/${createdWorker._id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        employeeId: newEmpId,
        phone: newPhone,
        badgeId: newBadge,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.payload);
    expect(patchBody.data.employment.employeeId).toBe(newEmpId);
    expect(patchBody.data.employment.badgeId).toBe(newBadge);
    expect(patchBody.data.profile.phone).toBe(newPhone);
  });
});
