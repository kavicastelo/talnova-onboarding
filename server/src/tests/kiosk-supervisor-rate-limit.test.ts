import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("K-SUP-003: Supervisor PIN Verification Rate Limiting & Account Lockout Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let supervisorUser: any;
  let secondarySupervisor: any;
  let kioskDevice: any;
  let journey: any;
  let activeSession: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();
  const supervisorPin = "7412";
  const supervisorPinHash = crypto.createHash("sha256").update(supervisorPin).digest("hex");

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "High-Risk Petrochemical Logistics",
      slug: `petrochem-logistics-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Primary Supervisor
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `lead-supervisor-${ts}@petrochem.com`,
        passwordHash: "hashed_pwd_7412",
      },
      profile: {
        firstName: "Viktor",
        lastName: "Navorski",
        fullName: "Viktor Navorski",
      },
      employment: {
        employeeId: `SUP-RATE-${ts}`,
        badgeId: `BADGE-RATE-${ts}`,
        department: "Chemical Containment Unit",
      },
      permissions: {
        role: "supervisor",
        customRoles: [],
      },
      security: {
        supervisorPinHash,
        failedLoginAttempts: 0,
        failedSupervisorPinAttempts: 0,
      },
      status: "active",
      isDeleted: false,
    });

    // 3. Create Secondary Supervisor for reset / independent tests
    secondarySupervisor = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `backup-supervisor-${ts}@petrochem.com`,
        passwordHash: "hashed_backup_pwd",
      },
      profile: {
        firstName: "Nadia",
        lastName: "Kovacs",
        fullName: "Nadia Kovacs",
      },
      employment: {
        employeeId: `SUP-BACKUP-${ts}`,
        badgeId: `BADGE-BACKUP-${ts}`,
        department: "Emergency Response",
      },
      permissions: {
        role: "supervisor",
        customRoles: [],
      },
      security: {
        supervisorPinHash,
        failedLoginAttempts: 0,
        failedSupervisorPinAttempts: 0,
      },
      status: "active",
      isDeleted: false,
    });

    // 4. Create Kiosk Device
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-RATE-GUID-${ts}`,
      hardwareGuid: `HW-RATE-GUID-${ts}`,
      name: "Containment Terminal Alpha",
      location: "Zone 4 Hazmat Airlock",
      status: "online",
      isPaired: true,
      lastSeen: new Date(),
    });

    // 5. Create Journey
    journey = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "Hazmat Vapor Suit Inspection & Pre-Entry Attestation",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [
        {
          id: "step_suit_check",
          type: "content",
          order: 0,
          title: "Vapor Suit Pressure Test",
          blocks: [],
          interaction: { type: "tap_to_continue" },
        },
        {
          id: "step_attestation",
          type: "checkpoint",
          order: 1,
          title: "Supervisor Gas Seal Verification",
          blocks: [],
          interaction: { type: "tap_to_continue" },
        },
      ],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        security: { protectionType: "none" },
      },
      publishing: {
        status: "published",
        version: 1,
        publishedAt: new Date(),
      },
    });

    // 6. Create Active Session
    activeSession = await KioskSessionModel.create({
      organizationId: testOrg._id,
      deviceId: kioskDevice._id,
      journeyId: journey._id,
      versionNumber: 1,
      sessionToken: `sess_token_rate_${ts}`,
      status: "awaiting_supervisor",
      startedAt: new Date(),
      durationSeconds: 90,
      currentStepId: "step_attestation",
      completedStepIds: ["step_suit_check"],
      isOfflineSync: false,
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
      await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
      await AuditLog.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  // =========================================================================
  // 1. Acceptance Criteria: 3 consecutive failed PIN attempts trigger 5-minute lockout
  // =========================================================================
  describe("Acceptance Criteria: 3 Failed Attempts Trigger 5-Minute Lockout", () => {
    it("increments failedSupervisorPinAttempts on 1st incorrect PIN and returns 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: "0001", // Incorrect PIN
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("INVALID_SUPERVISOR_PIN");

      const userDoc = await User.findById(supervisorUser._id);
      expect(userDoc?.security?.failedSupervisorPinAttempts).toBe(1);
      expect(userDoc?.security?.supervisorPinLockedUntil).toBeUndefined();
    });

    it("increments failedSupervisorPinAttempts to 2 on 2nd incorrect PIN and returns 401", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: "0002", // Incorrect PIN
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
      const userDoc = await User.findById(supervisorUser._id);
      expect(userDoc?.security?.failedSupervisorPinAttempts).toBe(2);
      expect(userDoc?.security?.supervisorPinLockedUntil).toBeUndefined();
    });

    it("locks supervisor account for 5 minutes on 3rd incorrect PIN and logs SUPERVISOR_PIN_LOCKOUT", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: "0003", // 3rd Incorrect PIN
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
      const userDoc = await User.findById(supervisorUser._id);
      expect(userDoc?.security?.failedSupervisorPinAttempts).toBe(3);
      expect(userDoc?.security?.supervisorPinLockedUntil).toBeInstanceOf(Date);

      // Verify lockedUntil is approximately 5 minutes in the future (~300 seconds)
      const diffMs = (userDoc?.security?.supervisorPinLockedUntil?.getTime() || 0) - Date.now();
      expect(diffMs).toBeGreaterThan(280 * 1000); // at least 280 seconds
      expect(diffMs).toBeLessThanOrEqual(305 * 1000); // at most 305 seconds

      // Verify security alert logged in AuditLog
      const lockoutAudit = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "SUPERVISOR_PIN_LOCKOUT",
        resourceId: supervisorUser._id,
      });

      expect(lockoutAudit).not.toBeNull();
      expect(lockoutAudit?.actorUserId?.toString()).toBe(supervisorUser._id.toString());
      expect(lockoutAudit?.eventCategory).toBe("security");
      expect(lockoutAudit?.severity).toBe("critical");
      expect(lockoutAudit?.metadata?.failedAttempts).toBe(3);
      expect(lockoutAudit?.metadata?.lockoutDurationSeconds).toBe(300);
      expect(lockoutAudit?.metadata?.sessionId).toBe(activeSession._id.toString());
    });

    it("rejects 4th attempt with HTTP 429 TOO_MANY_REQUESTS and remaining lockout seconds", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: "0004", // 4th attempt
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("TOO_MANY_REQUESTS");
      expect(body.remainingSeconds).toBeGreaterThan(0);
      expect(body.remainingSeconds).toBeLessThanOrEqual(300);

      // Verify Retry-After header
      expect(response.headers["retry-after"]).toBeDefined();
      const retryAfterVal = Number(response.headers["retry-after"]);
      expect(retryAfterVal).toBeGreaterThan(0);
      expect(retryAfterVal).toBeLessThanOrEqual(300);
    });

    it("rejects 5th attempt with HTTP 429 even when correct PIN is entered during lockout", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: supervisorPin, // Correct PIN, but account is locked
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("TOO_MANY_REQUESTS");
      expect(body.remainingSeconds).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 2. Counter Reset on Successful Verification
  // =========================================================================
  describe("Counter Reset on Successful PIN Verification", () => {
    it("resets failedSupervisorPinAttempts back to 0 on subsequent successful PIN entry", async () => {
      // Step 1: Submit 1 failed attempt for secondary supervisor
      const failResponse = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: secondarySupervisor.employment.employeeId,
          pin: "9999", // Incorrect
        },
      });
      expect(failResponse.statusCode).toBe(401);

      const userAfterFail = await User.findById(secondarySupervisor._id);
      expect(userAfterFail?.security?.failedSupervisorPinAttempts).toBe(1);

      // Step 2: Submit correct PIN
      const successResponse = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: secondarySupervisor.employment.employeeId,
          pin: supervisorPin, // Correct PIN
        },
      });
      expect(successResponse.statusCode).toBe(200);

      // Verify counter is atomically reset to 0
      const userAfterSuccess = await User.findById(secondarySupervisor._id);
      expect(userAfterSuccess?.security?.failedSupervisorPinAttempts).toBe(0);
      expect(userAfterSuccess?.security?.supervisorPinLockedUntil).toBeNull();
    });
  });

  // =========================================================================
  // 3. Lockout Expiration Recovery
  // =========================================================================
  describe("Lockout Expiration Recovery", () => {
    it("allows verification to succeed after the 5-minute lockout window expires", async () => {
      // Simulate lockout expiration by setting supervisorPinLockedUntil in the past
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      await User.findByIdAndUpdate(supervisorUser._id, {
        $set: {
          "security.supervisorPinLockedUntil": tenMinutesAgo,
          "security.failedSupervisorPinAttempts": 3,
        },
      });

      // Submit valid PIN after lockout has expired
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: supervisorPin, // Correct PIN
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.verified).toBe(true);

      // Verify lockout is cleared and failed count reset
      const refreshedUser = await User.findById(supervisorUser._id);
      expect(refreshedUser?.security?.failedSupervisorPinAttempts).toBe(0);
      expect(refreshedUser?.security?.supervisorPinLockedUntil).toBeNull();
    });
  });
});
