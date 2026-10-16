import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { FastifyInstance } from "fastify";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { hashPassword } from "../utils/crypto.js";

describe("Phase 2 — Universal Authentication Engine (Email, Employee ID, Phone)", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let kioskDevice: any;
  let userWithEmail: any;
  let userWithEmployeeId: any;
  let userWithPhone: any;

  const ts = Date.now();
  const password = "ValidPassword123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    testOrg = await Organization.create({
      name: `Multi-Identifier Test Org ${ts}`,
      slug: `multi-id-org-${ts}`,
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
    });

    const passwordHash = await hashPassword(password);

    // 1. Worker with Email
    userWithEmail = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-email-${ts}@test.com`,
        passwordHash,
        emailVerified: true,
      },
      profile: {
        firstName: "Alice",
        lastName: "EmailUser",
      },
      employment: {
        employeeId: `EMP-EMAIL-${ts}`,
        status: "active",
      },
      permissions: { role: "employee" },
    });

    // 2. Ground Worker with Employee ID (No email)
    userWithEmployeeId = await User.create({
      organizationId: testOrg._id,
      auth: {
        passwordHash,
      },
      profile: {
        firstName: "Bob",
        lastName: "GroundWorker",
      },
      employment: {
        employeeId: `EMP-GROUND-${ts}`,
        badgeId: `BDG-${ts}`,
        status: "active",
      },
      permissions: { role: "employee" },
    });

    // 3. Worker with Phone (No email, no employeeId -> auto-generates EMP-XXXXXX)
    userWithPhone = await User.create({
      organizationId: testOrg._id,
      auth: {
        passwordHash,
      },
      profile: {
        firstName: "Charlie",
        lastName: "PhoneUser",
        phone: `+1555${ts.toString().slice(-7)}`,
      },
      employment: {
        status: "active",
      },
      permissions: { role: "employee" },
    });

    // Kiosk Terminal
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      name: "Terminal A",
      deviceId: `DEV-KIOSK-${ts}`,
      location: "Warehouse Bay 1",
      status: "online",
      lastHeartbeatAt: new Date(),
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
    }
    await app.close();
  });

  // =========================================================================
  // WEB AUTHENTICATION (POST /api/v1/auth/login)
  // =========================================================================
  it("1. should authenticate user using email + password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithEmail.auth.email,
        password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user.email).toBe(userWithEmail.auth.email);
  });

  it("2. should authenticate ground worker using employeeId + password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithEmployeeId.employment.employeeId,
        password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user.id).toBe(userWithEmployeeId._id.toString());
  });

  it("3. should authenticate worker using phone number + password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithPhone.profile.phone,
        password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeDefined();
    expect(body.data.user.id).toBe(userWithPhone._id.toString());
  });

  it("4. should authenticate phone user using their auto-generated employeeId", async () => {
    expect(userWithPhone.employment.employeeId).toBeDefined();
    expect(userWithPhone.employment.employeeId.startsWith("EMP-")).toBe(true);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithPhone.employment.employeeId,
        password,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBe(userWithPhone._id.toString());
  });

  it("5. should reject login with invalid credentials", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: "NON_EXISTENT_IDENTIFIER",
        password: "WrongPassword123!",
      },
    });

    expect(res.statusCode).toBe(401);
  });

  // =========================================================================
  // KIOSK TERMINAL IDENTIFICATION (POST /api/v1/kiosk/identify)
  // =========================================================================
  it("6. should identify frontline worker via Employee ID on Kiosk", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: userWithEmployeeId.employment.employeeId,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.id).toBe(userWithEmployeeId._id.toString());
  });

  it("7. should identify frontline worker via Phone Number on Kiosk", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: userWithPhone.profile.phone,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.user.id).toBe(userWithPhone._id.toString());
  });

  it("8. should identify frontline worker via Badge ID on Kiosk", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: userWithEmployeeId.employment.badgeId,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.user.id).toBe(userWithEmployeeId._id.toString());
  });

  it("9. should return 404 when Kiosk identifier is not found", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "UNKNOWN-BADGE-9999",
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("WORKER_NOT_FOUND");
  });

  it("10. should identify frontline worker via numeric-only keypad entry matching Employee ID", async () => {
    // Create a worker with formatted ID EMP-8420
    const keypadWorker = await User.create({
      organizationId: testOrg._id,
      auth: { passwordHash: await hashPassword("KeypadPass123!") },
      profile: { firstName: "Keypad", lastName: "Frontline" },
      employment: { employeeId: "EMP-8420", status: "active" },
      permissions: { role: "employee" },
    });

    // Enter digits-only '8420' on the Kiosk keypad
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "8420",
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.worker.name).toBe("Keypad Frontline");
    expect(body.data.worker.employeeId).toBe("EMP-8420");
  });

  it("11. should lock non-email account after 5 consecutive failed login attempts", async () => {
    // Set 4 existing failed attempts on userWithEmployeeId
    await User.updateOne(
      { _id: userWithEmployeeId._id },
      { $set: { "security.failedLoginAttempts": 4, "security.lockedUntil": null } }
    );

    // 5th failed attempt with invalid password
    const failedRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithEmployeeId.employment.employeeId,
        password: "IncorrectPassword!",
      },
    });

    // 5th failed attempt triggers 403 Forbidden with lockout notice
    expect(failedRes.statusCode).toBe(403);
    const failedBody = JSON.parse(failedRes.payload);
    expect(failedBody.message).toContain("Account locked");

    // Verify DB record now has lockedUntil set in the future
    const lockedUser = await User.findById(userWithEmployeeId._id);
    expect(lockedUser?.security?.lockedUntil).toBeDefined();
    expect(new Date(lockedUser!.security!.lockedUntil!).getTime()).toBeGreaterThan(Date.now());

    // Subsequent login attempt while locked must return 403 without even running password check
    const lockedRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: userWithEmployeeId.employment.employeeId,
        password: password, // Even with correct password
      },
    });
    expect(lockedRes.statusCode).toBe(403);
    const lockedBody = JSON.parse(lockedRes.payload);
    expect(lockedBody.message).toContain("Account is locked");
  }, 30000);

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });
});
