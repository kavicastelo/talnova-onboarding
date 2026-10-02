import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import { KioskPairingCodeModel } from "../modules/kiosk/models/kiosk-pairing-code.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";

describe("K-CMP-003: Immutable Kiosk Compliance Audit Trail", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let otherOrg: any;
  let adminUser: any;
  let adminToken: string;
  let supervisorUser: any;
  let workerUser: any;
  let workerToken: string;
  let deviceToken: string;
  let pairedKioskDevice: any;
  let testJourney: any;

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();
  const supervisorPin = "8391";
  const supervisorPinHash = crypto.createHash("sha256").update(supervisorPin).digest("hex");
  const testHardwareGuid = `HW-AUDIT-${ts}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Primary Organization
    testOrg = await Organization.create({
      name: `Compliance Audit Facility ${ts}`,
      slug: `audit-facility-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false,
    });

    // 2. Create Secondary Organization (for isolation testing)
    otherOrg = await Organization.create({
      name: `Competitor Facility ${ts}`,
      slug: `other-facility-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false,
    });

    // 3. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `compliance-admin-${ts}@audit.test`,
        passwordHash: "mock_password_hash",
      },
      profile: {
        firstName: "Victoria",
        lastName: "AuditLead",
        fullName: "Victoria AuditLead",
      },
      employment: {
        employeeId: `ADM-AUDIT-${ts}`,
        badgeId: `BADGE-ADM-${ts}`,
        department: "Regulatory Compliance",
      },
      permissions: {
        role: "admin",
      },
      status: "active",
      isDeleted: false,
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 4. Create Supervisor User
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `supervisor-${ts}@audit.test`,
        passwordHash: "mock_password_hash",
      },
      profile: {
        firstName: "Marcus",
        lastName: "Vance",
        fullName: "Marcus Vance",
      },
      employment: {
        employeeId: `SUP-AUDIT-${ts}`,
        badgeId: `BADGE-SUP-${ts}`,
        department: "Facility Safety",
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

    // 5. Create Frontline Worker
    workerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-${ts}@audit.test`,
        passwordHash: "mock_password_hash",
      },
      profile: {
        firstName: "Leon",
        lastName: "Balor",
        fullName: "Leon Balor",
      },
      employment: {
        employeeId: `EMP-AUDIT-${ts}`,
        badgeId: `BADGE-EMP-${ts}`,
        department: "Refinery Line A",
      },
      role: "frontline_worker_kiosk",
      status: "active",
      isDeleted: false,
      statistics: {
        completedJourneys: 0,
        certificates: 0,
      },
    });

    workerToken = app.jwt.sign({
      userId: workerUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "frontline_worker_kiosk",
    });
  });

  afterAll(async () => {
    await AuditLog.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await KioskPairingCodeModel.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await KioskSessionModel.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await EmployeeAssignment.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await User.deleteMany({ organizationId: { $in: [testOrg._id, otherOrg._id] } });
    await Organization.deleteMany({ _id: { $in: [testOrg._id, otherOrg._id] } });
    await app.close();
  });

  // =========================================================================
  // 1. KIOSK_DEVICE_PAIRED Event Audit Trail
  // =========================================================================
  describe("KIOSK_DEVICE_PAIRED Event", () => {
    it("records a structured immutable KIOSK_DEVICE_PAIRED audit log with hardware GUID and pairedBy user", async () => {
      // Step A: Admin requests pairing code
      const codeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { deviceId: testHardwareGuid },
      });

      expect(codeRes.statusCode).toBe(200);
      const { code } = JSON.parse(codeRes.body);
      expect(code).toBeDefined();

      // Step B: Kiosk device submits pairing code
      const pairRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: testHardwareGuid,
          name: "Gate 4 Turnstile Kiosk",
          location: "North Compound Entrance",
        },
      });

      expect(pairRes.statusCode).toBe(200);
      const pairBody = JSON.parse(pairRes.body);
      expect(pairBody.deviceToken).toBeDefined();
      deviceToken = pairBody.deviceToken;
      pairedKioskDevice = pairBody.device;

      // Step C: Verify AuditLog record
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_DEVICE_PAIRED",
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventCategory).toBe("kiosk");
      expect(auditLog?.action).toBe("pair");
      expect(auditLog?.resourceType).toBe("kiosk_device");
      expect(auditLog?.actorUserId?.toString()).toBe(adminUser._id.toString());
      expect(auditLog?.metadata?.deviceId).toBe(testHardwareGuid);
      expect(auditLog?.metadata?.hardwareGuid).toBe(testHardwareGuid);
      expect(auditLog?.metadata?.name).toBe("Gate 4 Turnstile Kiosk");
      expect(auditLog?.metadata?.location).toBe("North Compound Entrance");
      expect(auditLog?.metadata?.pairedBy).toBe(adminUser._id.toString());
      expect(auditLog?.createdAt).toBeInstanceOf(Date);
    });
  });

  // =========================================================================
  // 2. KIOSK_JOURNEY_PUBLISHED Event Audit Trail
  // =========================================================================
  describe("KIOSK_JOURNEY_PUBLISHED Event", () => {
    it("records a structured immutable KIOSK_JOURNEY_PUBLISHED audit log with snapshot version and publisher ID", async () => {
      // Step A: Create draft journey
      testJourney = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Confined Space Entry Protocol 2026",
        description: "Mandatory pre-entry atmospheric check and supervisor witness verification",
        languages: ["en"],
        createdBy: adminUser._id,
        isDeleted: false,
        publishing: {
          status: "draft",
          version: 1,
        },
        steps: [
          {
            id: "step_atmosphere_check",
            type: "instruction_step",
            order: 0,
            title: "Atmospheric Calibration",
            blocks: [],
            interaction: { type: "tap_to_continue" },
          },
          {
            id: "step_supervisor_witness",
            type: "interactive_confirmation",
            order: 1,
            title: "Supervisor Gas Check Attestation",
            blocks: [],
            interaction: {
              type: "hold_to_confirm",
              prompt: "Supervisor must confirm gas levels before hatch seal breaks",
            },
          },
          {
            id: "step_complete",
            type: "completion",
            order: 2,
            title: "Safety Completion",
            interaction: { type: "tap_to_continue" },
          },
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none", requireSupervisorWitness: true },
        },
      });

      // Step B: Admin publishes journey
      const publishRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${testJourney._id}/publish`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { changelog: "Initial compliance baseline v1" },
      });

      expect(publishRes.statusCode).toBe(200);
      const publishBody = JSON.parse(publishRes.body);
      expect(publishBody.data.publishing.status).toBe("published");
      expect(publishBody.data.publishing.version).toBe(1);

      // Step C: Verify AuditLog record
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_JOURNEY_PUBLISHED",
        resourceId: testJourney._id,
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventCategory).toBe("kiosk");
      expect(auditLog?.action).toBe("publish");
      expect(auditLog?.actorUserId?.toString()).toBe(adminUser._id.toString());
      expect(auditLog?.metadata?.journeyId).toBe(testJourney._id.toString());
      expect(auditLog?.metadata?.versionSnapshot).toBe(1);
      expect(auditLog?.metadata?.version).toBe(1);
      expect(auditLog?.metadata?.publisherId).toBe(adminUser._id.toString());
      expect(auditLog?.metadata?.contentChecksum).toBeDefined();
      expect(auditLog?.metadata?.changelog).toBe("Initial compliance baseline v1");
    });
  });

  // =========================================================================
  // 3. KIOSK_SUPERVISOR_WITNESSED Event Audit Trail
  // =========================================================================
  describe("KIOSK_SUPERVISOR_WITNESSED Event", () => {
    it("records a structured immutable KIOSK_SUPERVISOR_WITNESSED audit log with supervisor ID, employee ID, session ID, device ID", async () => {
      // Step A: Create awaiting_supervisor kiosk session
      const session = await KioskSessionModel.create({
        organizationId: testOrg._id,
        deviceId: pairedKioskDevice._id || pairedKioskDevice.id,
        journeyId: testJourney._id,
        userId: workerUser._id,
        versionNumber: 1,
        sessionToken: `sess_witness_${ts}`,
        status: "awaiting_supervisor",
        startedAt: new Date(),
        currentStepId: "step_supervisor_witness",
        completedStepIds: ["step_atmosphere_check"],
        isOfflineSync: false,
      });

      // Step B: Supervisor enters PIN to verify
      const witnessRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/supervisor/verify-pin",
        payload: {
          supervisorIdentifier: supervisorUser.auth.email,
          pin: supervisorPin,
          sessionId: session._id.toString(),
          deviceId: testHardwareGuid,
          organizationId: testOrg._id.toString(),
        },
      });

      expect(witnessRes.statusCode).toBe(200);
      const witnessBody = JSON.parse(witnessRes.body);
      expect(witnessBody.verified).toBe(true);

      // Step C: Verify Compliance AuditLog record
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_SUPERVISOR_WITNESSED",
        resourceId: session._id,
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventCategory).toBe("kiosk");
      expect(auditLog?.action).toBe("witness");
      expect(auditLog?.actorUserId?.toString()).toBe(supervisorUser._id.toString());
      expect(auditLog?.metadata?.supervisorId).toBe(supervisorUser._id.toString());
      expect(auditLog?.metadata?.employeeId).toBe(workerUser._id.toString());
      expect(auditLog?.metadata?.sessionId).toBe(session._id.toString());
      expect(auditLog?.metadata?.deviceId?.toString()).toBe((pairedKioskDevice._id || pairedKioskDevice.id).toString());
      expect(auditLog?.metadata?.method).toBe("pin");
    });
  });

  // =========================================================================
  // 4. KIOSK_COMPLETION_RECORDED Event Audit Trail
  // =========================================================================
  describe("KIOSK_COMPLETION_RECORDED Event", () => {
    it("records a structured immutable KIOSK_COMPLETION_RECORDED audit log with employee ID, journey version, verification checksum", async () => {
      // Step A: Create active session ready for completion
      const session = await KioskSessionModel.create({
        organizationId: testOrg._id,
        deviceId: pairedKioskDevice._id || pairedKioskDevice.id,
        journeyId: testJourney._id,
        userId: workerUser._id,
        versionNumber: 1,
        sessionToken: `sess_completion_${ts}`,
        status: "active",
        startedAt: new Date(Date.now() - 120000),
        currentStepId: "step_complete",
        completedStepIds: ["step_atmosphere_check", "step_supervisor_witness", "step_complete"],
        supervisorWitness: {
          supervisorId: supervisorUser._id,
          method: "pin",
          witnessedAt: new Date(),
        },
        isOfflineSync: false,
      });

      // Step B: Submit completion
      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${session._id}/complete`,
        headers: { Authorization: `Bearer ${workerToken}` },
        payload: {
          completedStepIds: ["step_atmosphere_check", "step_supervisor_witness", "step_complete"],
          durationSeconds: 120,
          quizScore: 100,
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const completeBody = JSON.parse(completeRes.body);
      const returnedChecksum = completeBody.data.verificationChecksum;
      expect(returnedChecksum).toBeDefined();

      // Step C: Verify KIOSK_COMPLETION_RECORDED AuditLog entry
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_COMPLETION_RECORDED",
        resourceId: session._id,
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventCategory).toBe("kiosk");
      expect(auditLog?.action).toBe("complete");
      expect(auditLog?.actorUserId?.toString()).toBe(workerUser._id.toString());
      expect(auditLog?.metadata?.employeeId).toBe(workerUser._id.toString());
      expect(auditLog?.metadata?.journeyVersion).toBe(1);
      expect(auditLog?.metadata?.verificationChecksum).toBe(returnedChecksum);
      expect(auditLog?.metadata?.sessionId).toBe(session._id.toString());
      expect(auditLog?.metadata?.deviceId?.toString()).toBe((pairedKioskDevice._id || pairedKioskDevice.id).toString());
    });
  });

  // =========================================================================
  // 5. KIOSK_DEVICE_REVOKED Event Audit Trail
  // =========================================================================
  describe("KIOSK_DEVICE_REVOKED Event", () => {
    it("records a structured immutable KIOSK_DEVICE_REVOKED audit log with device ID, reason, and admin ID", async () => {
      // Step A: Admin revokes the paired kiosk device
      const revokeRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/kiosk/devices/${pairedKioskDevice._id || pairedKioskDevice.id}`,
        headers: { Authorization: `Bearer ${adminToken}` },
        payload: { reason: "Damaged touchscreen hardware replaced" },
      });

      expect(revokeRes.statusCode).toBe(200);

      // Step B: Verify KIOSK_DEVICE_REVOKED AuditLog entry
      const auditLog = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_DEVICE_REVOKED",
        resourceId: pairedKioskDevice._id || pairedKioskDevice.id,
      });

      expect(auditLog).not.toBeNull();
      expect(auditLog?.eventCategory).toBe("kiosk");
      expect(auditLog?.action).toBe("revoke");
      expect(auditLog?.actorUserId?.toString()).toBe(adminUser._id.toString());
      expect(auditLog?.metadata?.deviceId).toBe(testHardwareGuid);
      expect(auditLog?.metadata?.hardwareGuid).toBe(testHardwareGuid);
      expect(auditLog?.metadata?.reason).toBe("Damaged touchscreen hardware replaced");
      expect(auditLog?.metadata?.adminId).toBe(adminUser._id.toString());
      expect(auditLog?.severity).toBe("warning");
    });
  });

  // =========================================================================
  // 6. Regulatory Audit Query & Tenant Isolation
  // =========================================================================
  describe("Audit Trail Querying & Immutability Guarantees", () => {
    it("enables administrative filtering for category: 'kiosk' with tenant isolation and immutability", async () => {
      // Query all kiosk compliance events for primary organization
      const kioskEvents = await AuditLog.find({
        organizationId: testOrg._id,
        eventCategory: "kiosk",
      }).sort({ createdAt: 1 });

      const eventTypes = kioskEvents.map((e) => e.eventType);
      expect(eventTypes).toContain("KIOSK_DEVICE_PAIRED");
      expect(eventTypes).toContain("KIOSK_JOURNEY_PUBLISHED");
      expect(eventTypes).toContain("KIOSK_SUPERVISOR_WITNESSED");
      expect(eventTypes).toContain("KIOSK_COMPLETION_RECORDED");
      expect(eventTypes).toContain("KIOSK_DEVICE_REVOKED");

      // Verify each event has tenant context and valid createdAt timestamp
      for (const event of kioskEvents) {
        expect(event.organizationId?.toString()).toBe(testOrg._id.toString());
        expect(event.createdAt).toBeInstanceOf(Date);
        // Mongoose schema has updatedAt: false for AuditLog
        expect((event as any).updatedAt).toBeUndefined();
      }

      // Verify Tenant Isolation: Secondary organization has zero kiosk audit events
      const otherOrgEvents = await AuditLog.find({
        organizationId: otherOrg._id,
        eventCategory: "kiosk",
      });
      expect(otherOrgEvents).toHaveLength(0);
    });
  });
});
