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

describe("K-SUP-001: Supervisor Witness PIN Verification & Audit Binding Backend Integration Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let supervisorUser: any;
  let managerUser: any;
  let regularEmployee: any;
  let kioskDevice: any;
  let journey: any;
  let activeSession: any;
  let awaitingSession: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();
  const supervisorPin = "4826";
  const supervisorPinHash = crypto.createHash("sha256").update(supervisorPin).digest("hex");

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Frontline Industrial Logistics",
      slug: `frontline-ind-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Supervisor with role 'supervisor' and 4-digit PIN
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `supervisor-${ts}@frontline.com`,
        passwordHash: "hashed_supervisor_pwd",
      },
      profile: {
        firstName: "Elena",
        lastName: "Rostova",
        fullName: "Elena Rostova",
      },
      employment: {
        employeeId: `SUP-${ts}`,
        badgeId: `BADGE-SUP-${ts}`,
        department: "Safety & Compliance Operations",
      },
      permissions: {
        role: "supervisor",
        customRoles: [],
      },
      security: {
        supervisorPinHash,
        failedLoginAttempts: 0,
      },
      status: "active",
      isDeleted: false,
    });

    // 3. Create Manager with role 'manager' and same 4-digit PIN
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-${ts}@frontline.com`,
        passwordHash: "hashed_manager_pwd",
      },
      profile: {
        firstName: "David",
        lastName: "Miller",
        fullName: "David Miller",
      },
      employment: {
        employeeId: `MGR-${ts}`,
        badgeId: `BADGE-MGR-${ts}`,
        department: "Site Leadership",
      },
      permissions: {
        role: "manager",
        customRoles: [],
      },
      security: {
        supervisorPinHash,
        failedLoginAttempts: 0,
      },
      status: "active",
      isDeleted: false,
    });

    // 4. Create Standard Non-Supervisor Employee
    regularEmployee = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-${ts}@frontline.com`,
        passwordHash: "hashed_emp_pwd",
      },
      profile: {
        firstName: "Carlos",
        lastName: "Mendez",
        fullName: "Carlos Mendez",
      },
      employment: {
        employeeId: `EMP-${ts}`,
        badgeId: `BADGE-EMP-${ts}`,
        department: "Warehouse Packing",
      },
      permissions: {
        role: "employee",
        customRoles: [],
      },
      security: {
        supervisorPinHash,
        failedLoginAttempts: 0,
      },
      status: "active",
      isDeleted: false,
    });

    // 5. Create Kiosk Device
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-GUID-SUP-${ts}`,
      hardwareGuid: `HW-GUID-SUP-${ts}`,
      name: "Dock Gate Terminal 1",
      location: "East Loading Bay",
      status: "online",
      isPaired: true,
      lastSeen: new Date(),
    });

    // 6. Create Journey
    journey = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "Confined Space & Hazardous Entry Briefing",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [
        {
          id: "step_intro",
          type: "content",
          order: 0,
          title: "Pre-Entry Protocol",
          blocks: [],
          interaction: { type: "tap_to_continue" },
        },
        {
          id: "step_witness",
          type: "checkpoint",
          order: 1,
          title: "Supervisor Gas Check Attestation",
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

    // 7. Create Session in status 'awaiting_supervisor'
    awaitingSession = await KioskSessionModel.create({
      organizationId: testOrg._id,
      deviceId: kioskDevice._id,
      journeyId: journey._id,
      versionNumber: 1,
      sessionToken: `sess_token_awaiting_${ts}`,
      status: "awaiting_supervisor",
      startedAt: new Date(),
      durationSeconds: 120,
      currentStepId: "step_witness",
      completedStepIds: ["step_intro"],
      isOfflineSync: false,
    });

    // 8. Create Standard Active Session
    activeSession = await KioskSessionModel.create({
      organizationId: testOrg._id,
      deviceId: kioskDevice._id,
      journeyId: journey._id,
      versionNumber: 1,
      sessionToken: `sess_token_active_${ts}`,
      status: "active",
      startedAt: new Date(),
      durationSeconds: 60,
      currentStepId: "step_intro",
      completedStepIds: [],
      isOfflineSync: false,
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    await AuditLog.deleteMany({ organizationId: testOrg._id });
    await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
    await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
    await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
    await User.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteMany({ _id: testOrg._id });
    await app.close();
  });

  // =========================================================================
  // 1. Acceptance Criteria 1: Valid Supervisor PIN Binds Attestation to Session
  // =========================================================================
  describe("Acceptance Criteria 1: Witness Attestation Session Binding", () => {
    it("binds supervisorWitness, transitions awaiting_supervisor to active, and returns verified: true", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.employment.badgeId,
          pin: supervisorPin,
          sessionId: awaitingSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify response envelope
      expect(body.success).toBe(true);
      expect(body.verified).toBe(true);
      expect(body.supervisor).toBeDefined();
      expect(body.supervisor.id).toBe(supervisorUser._id.toString());
      expect(body.supervisor.role).toBe("supervisor");
      expect(body.witnessToken).toBeDefined();

      // Verify session document in database
      const updatedSession = await KioskSessionModel.findById(awaitingSession._id);
      expect(updatedSession).not.toBeNull();
      expect(updatedSession?.status).toBe("active");
      expect(updatedSession?.supervisorWitness).toBeDefined();
      expect(updatedSession?.supervisorWitness?.supervisorId.toString()).toBe(supervisorUser._id.toString());
      expect(updatedSession?.supervisorWitness?.method).toBe("pin");
      expect(updatedSession?.supervisorWitness?.witnessedAt).toBeInstanceOf(Date);

      // Verify failedLoginAttempts reset to 0
      const supervisorDoc = await User.findById(supervisorUser._id);
      expect(supervisorDoc?.security?.failedLoginAttempts).toBe(0);
    });

    it("creates an immutable audit log entry KIOSK_SUPERVISOR_WITNESS_CONFIRMED", async () => {
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_SUPERVISOR_WITNESS_CONFIRMED",
        resourceId: awaitingSession._id,
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorUserId?.toString()).toBe(supervisorUser._id.toString());
      expect(auditLog?.eventCategory).toBe("security");
      expect(auditLog?.action).toBe("update");
      expect(auditLog?.metadata?.method).toBe("pin");
      expect(auditLog?.metadata?.supervisorRole).toBe("supervisor");
      expect(auditLog?.metadata?.sessionId).toBe(awaitingSession._id.toString());
    });

    it("automatically infers organizationId from sessionId when organizationId is omitted", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          supervisorIdentifier: managerUser.auth.email,
          pin: supervisorPin,
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.verified).toBe(true);
      expect(body.supervisor.role).toBe("manager");

      const sessionDoc = await KioskSessionModel.findById(activeSession._id);
      expect(sessionDoc?.supervisorWitness?.supervisorId.toString()).toBe(managerUser._id.toString());
    });
  });

  // =========================================================================
  // 2. Acceptance Criteria 2: Invalid Supervisor PIN Rejection & Lockout Counter
  // =========================================================================
  describe("Acceptance Criteria 2: Incorrect PIN Rejection & Failed Attempts Tracking", () => {
    it("returns 401 INVALID_SUPERVISOR_PIN and increments failedLoginAttempts when PIN is incorrect", async () => {
      // Get initial counter
      const initialUser = await User.findById(supervisorUser._id);
      const initialAttempts = initialUser?.security?.failedLoginAttempts || 0;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.employment.employeeId,
          pin: "0000", // Incorrect PIN
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("INVALID_SUPERVISOR_PIN");

      // Verify counter was incremented in MongoDB
      const updatedUser = await User.findById(supervisorUser._id);
      expect(updatedUser?.security?.failedLoginAttempts).toBe(initialAttempts + 1);

      // Verify session was NOT updated
      const sessionDoc = await KioskSessionModel.findById(activeSession._id);
      expect(sessionDoc?.supervisorWitness?.supervisorId.toString()).not.toBe(supervisorUser._id.toString());
    });

    it("subsequent failed attempts continue to increment failedLoginAttempts sequentially", async () => {
      await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.employment.employeeId,
          pin: "9999",
        },
      });

      const updatedUser = await User.findById(supervisorUser._id);
      expect(updatedUser?.security?.failedLoginAttempts).toBeGreaterThanOrEqual(2);
    });

    it("resets failedLoginAttempts back to 0 on subsequent successful PIN entry", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.employment.employeeId,
          pin: supervisorPin, // Correct PIN
        },
      });

      expect(response.statusCode).toBe(200);
      const updatedUser = await User.findById(supervisorUser._id);
      expect(updatedUser?.security?.failedLoginAttempts).toBe(0);
    });
  });

  // =========================================================================
  // 3. Requirement 1: Role Authorization Gate
  // =========================================================================
  describe("Requirement 1: Authorized Supervisor Roles Enforcement", () => {
    it("rejects non-supervisor employees (role: employee) with 404 SUPERVISOR_NOT_FOUND", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: regularEmployee.auth.email,
          pin: supervisorPin,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("SUPERVISOR_NOT_FOUND");
    });

    it("rejects unknown / non-existent supervisor identifier with 404 SUPERVISOR_NOT_FOUND", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: "non_existent_badge_9999",
          pin: "1234",
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 4. Session Existence & Timing-Safe Hashing
  // =========================================================================
  describe("Session Validation & Timing-Safe Hash Verification", () => {
    it("returns 404 NOT_FOUND when sessionId does not exist", async () => {
      const nonExistentSessionId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: supervisorPin,
          sessionId: nonExistentSessionId,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code || body.error?.code).toBe("NOT_FOUND");
    });

    it("generates a signed witness token with supervisorId and sessionId in payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          organizationId: testOrg._id.toString(),
          supervisorIdentifier: supervisorUser.auth.email,
          pin: supervisorPin,
          sessionId: activeSession._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.witnessToken).toBeTypeOf("string");

      // Verify token payload decode
      const decoded: any = (app as any).jwt.decode(body.witnessToken);
      expect(decoded).not.toBeNull();
      expect(decoded.sub).toBe(supervisorUser._id.toString());
      expect(decoded.supervisorId).toBe(supervisorUser._id.toString());
      expect(decoded.sessionId).toBe(activeSession._id.toString());
      expect(decoded.method).toBe("pin");
      expect(decoded.type).toBe("kiosk_supervisor_witness");
    });
  });
});
