import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyVersionModel } from "../modules/kiosk/models/kiosk-journey-version.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("K-CMP-001: Server-Authoritative Completion Verification & Checksum Engine", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let frontlineWorker: any;
  let supervisorUser: any;
  let workerToken: string;
  let kioskDevice: any;

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Global Steel Works",
      slug: `global-steel-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false,
    });

    // 2. Create Supervisor
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `supervisor-${ts}@steel.com`,
        passwordHash: "hashed_pwd_sup",
      },
      profile: {
        firstName: "Elena",
        lastName: "Rostova",
      },
      role: "manager",
      status: "active",
      isDeleted: false,
    });

    // 3. Create Frontline Worker
    frontlineWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-${ts}@steel.com`,
        passwordHash: "hashed_pwd_worker",
      },
      profile: {
        firstName: "Tomas",
        lastName: "Navarro",
      },
      employment: {
        employeeId: `EMP-CMP-${ts}`,
        badgeId: `BADGE-CMP-${ts}`,
        department: "Blast Furnace Sector",
      },
      role: "frontline_worker_kiosk",
      status: "active",
      isDeleted: false,
      statistics: {
        completedJourneys: 0,
        certificates: 0,
        coursesCompleted: 0,
      },
    });

    // 4. Create Kiosk Device
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-GUID-CMP-${ts}`,
      hardwareGuid: `HW-GUID-CMP-${ts}`,
      name: "Furnace Entry Gate Kiosk",
      location: "Sector 3 North Gate",
      status: "online",
      isPaired: true,
      lastSeen: new Date(),
    });

    // 5. Issue Frontline Worker Ephemeral Token via /identify
    const resIdentify = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: `BADGE-CMP-${ts}`,
        kioskDeviceId: kioskDevice.deviceId,
      },
    });
    expect(resIdentify.statusCode).toBe(200);
    const identifyData = JSON.parse(resIdentify.payload).data;
    workerToken = identifyData.token || identifyData.sessionToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. Mandatory Steps Progression Enforcement (Acceptance Criteria 1)
  // =========================================================================
  describe("Mandatory Steps Gate Enforcement", () => {
    it("rejects completion with 400 COMPLETION_GATE_VIOLATION detailing missing steps when mandatory steps are skipped", async () => {
      // Create journey with 2 mandatory steps and 1 optional step
      const journey = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Confined Space Entry Briefing",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_air_quality",
            type: "content",
            order: 0,
            title: "Atmospheric Air Testing",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
          {
            id: "step_lifeline_rigging",
            type: "content",
            order: 1,
            title: "Harness & Lifeline Rigging",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
          {
            id: "step_feedback_survey",
            type: "content",
            order: 2,
            title: "Optional Feedback",
            blocks: [],
            interaction: { type: "tap_anywhere" },
            isOptional: true,
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

      // Start session
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
        },
      });
      expect(createRes.statusCode).toBe(201);
      const sessionId = JSON.parse(createRes.payload).data._id;

      // Complete ONLY step 1
      await app.inject({
        method: "PATCH",
        url: `/api/v1/kiosk/sessions/${sessionId}/progress`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          stepId: "step_lifeline_rigging",
          completedStepId: "step_air_quality",
        },
      });

      // Attempt to complete session with step_lifeline_rigging still missing
      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {},
      });

      expect(completeRes.statusCode).toBe(400);
      const body = JSON.parse(completeRes.payload);
      expect(body.error).toBe("COMPLETION_GATE_VIOLATION");
      expect(body.code).toBe("COMPLETION_GATE_VIOLATION");
      expect(body.message).toContain("Mandatory steps incomplete");
      expect(body.missingStepIds || body.details?.missingStepIds).toContain("step_lifeline_rigging");
      expect(body.missingStepIds || body.details?.missingStepIds).not.toContain("step_feedback_survey");
    });
  });

  // =========================================================================
  // 2. Minimum Dwell Time Enforcement (ADR-007)
  // =========================================================================
  describe("Minimum Dwell Time Enforcement", () => {
    it("rejects completion with 400 COMPLETION_GATE_VIOLATION when total duration is under minimumDurationSeconds", async () => {
      const journey = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Arc Flash Protection Standards",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_arc_overview",
            type: "content",
            order: 0,
            title: "Arc Flash Boundaries",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          minimumDurationSeconds: 45, // Requires at least 45 seconds
          security: { protectionType: "none" },
        },
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(),
        },
      });

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
        },
      });
      const sessionId = JSON.parse(createRes.payload).data._id;

      // Submit only 12 seconds
      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          completedStepIds: ["step_arc_overview"],
          durationSeconds: 12,
        },
      });

      expect(completeRes.statusCode).toBe(400);
      const body = JSON.parse(completeRes.payload);
      expect(body.error).toBe("COMPLETION_GATE_VIOLATION");
      expect(body.message).toContain("Minimum dwell time of 45s not satisfied");
    });
  });

  // =========================================================================
  // 3. Quiz Score Threshold Validation
  // =========================================================================
  describe("Quiz Passing Score Enforcement", () => {
    it("rejects completion with 400 COMPLETION_GATE_VIOLATION when quiz score is below passing threshold", async () => {
      const journey = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "High Voltage Isolation Protocol",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_quiz_1",
            type: "content",
            order: 0,
            title: "Lockout/Tagout Comprehension",
            blocks: [],
            interaction: {
              type: "quiz",
              quiz: {
                passingScore: 80,
                questions: [
                  {
                    id: "q1",
                    question: "Who holds the key to the lockout padlock?",
                    options: ["Anyone", "Only the worker who placed it"],
                    correctOptionIndex: 1,
                  },
                ],
              },
            },
            isMandatory: true,
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

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
        },
      });
      const sessionId = JSON.parse(createRes.payload).data._id;

      // Submit with failing quiz score 60% (< 80%)
      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          completedStepIds: ["step_quiz_1"],
          quizScore: 60,
        },
      });

      expect(completeRes.statusCode).toBe(400);
      const body = JSON.parse(completeRes.payload);
      expect(body.error).toBe("COMPLETION_GATE_VIOLATION");
      expect(body.message).toContain("Quiz score of 60 does not meet minimum passing threshold of 80%");
    });
  });

  // =========================================================================
  // 4. Supervisor Dual Attestation Gate
  // =========================================================================
  describe("Supervisor Witness Dual Attestation Gate", () => {
    it("transitions session to 'awaiting_supervisor' without minting checksum if witness attestation is absent", async () => {
      const witnessJourney = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Molten Iron Pouring Safety",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_ladle_inspection",
            type: "content",
            order: 0,
            title: "Refractory Ladle Inspection",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
            requireSupervisorWitness: true,
          },
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          requireSupervisorWitness: true,
          security: { protectionType: "none" },
        },
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(),
        },
      });

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: witnessJourney._id.toString(),
        },
      });
      const sessionId = JSON.parse(createRes.payload).data._id;

      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          completedStepIds: ["step_ladle_inspection"],
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const body = JSON.parse(completeRes.payload);
      expect(body.data.status).toBe("awaiting_supervisor");
      expect(body.data.verificationChecksum).toBeUndefined();
      expect(body.data.completedAt).toBeUndefined();

      const doc = await KioskSessionModel.findById(sessionId);
      expect(doc?.status).toBe("awaiting_supervisor");
      expect(doc?.verificationChecksum).toBeUndefined();
    });

    it("successfully completes when supervisor dual attestation is present", async () => {
      const witnessJourney = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Molten Ladle Handling - Supervisor Verified",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_pour_check",
            type: "content",
            order: 0,
            title: "Pre-pour Check",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          requireSupervisorWitness: true,
          security: { protectionType: "none" },
        },
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(),
        },
      });

      // Create session with supervisor witness attestation pre-attached
      const session = await KioskSessionModel.create({
        organizationId: testOrg._id,
        deviceId: kioskDevice._id,
        journeyId: witnessJourney._id,
        versionNumber: 1,
        userId: frontlineWorker._id,
        sessionToken: `token-witness-${Date.now()}`,
        status: "active",
        durationSeconds: 60,
        completedStepIds: ["step_pour_check"],
        supervisorWitness: {
          supervisorId: supervisorUser._id,
          witnessedAt: new Date(),
          method: "pin",
        },
      });

      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${session._id}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          durationSeconds: 70,
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const body = JSON.parse(completeRes.payload);
      expect(body.data.status).toBe("completed");
      expect(body.data.verificationChecksum).toBeDefined();
      expect(body.data.verificationChecksum).toHaveLength(64);
    });
  });

  // =========================================================================
  // 5. Successful Server-Authoritative Completion & Cryptographic Minting
  // =========================================================================
  describe("Server-Authoritative Completion & Checksum Minting (Acceptance Criteria 2)", () => {
    it("mints SHA-256 HMAC checksum, transitions to 'completed', updates employee profile statistics and assignments, and records audit log", async () => {
      // 1. Create compliant journey
      const journey = await KioskJourneyModel.create({
        organizationId: testOrg._id,
        title: "Heavy Machinery Pre-Operational Safety",
        languages: ["en"],
        createdBy: dummyAdminId,
        isDeleted: false,
        steps: [
          {
            id: "step_fluid_check",
            type: "content",
            order: 0,
            title: "Hydraulic Fluid & Oil Levels",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
          {
            id: "step_brake_test",
            type: "content",
            order: 1,
            title: "Brake & Emergency Stop Testing",
            blocks: [],
            interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
            isMandatory: true,
          },
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          minimumDurationSeconds: 30,
          passingScorePercentage: 75,
          security: { protectionType: "none" },
        },
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(),
        },
      });

      // 2. Create pinned version snapshot
      const journeyVersion = await KioskJourneyVersionModel.create({
        organizationId: testOrg._id,
        journeyId: journey._id,
        version: 1,
        title: journey.title,
        languages: journey.languages,
        steps: journey.steps,
        settings: journey.settings,
        contentChecksum: "sha256-pre-op-checksum",
        publishedBy: dummyAdminId,
        publishedAt: new Date(),
        status: "published",
      });

      // 3. Create initial Assignment for the worker
      const assignment = await EmployeeAssignment.create({
        organizationId: testOrg._id,
        employeeId: frontlineWorker._id,
        assignedBy: dummyAdminId,
        journey: {
          journeyId: journey._id,
          title: journey.title,
          version: 1,
        },
        assignment: {
          assignedAt: new Date(),
          priority: "high",
        },
        status: "assigned",
      });

      // 4. Record initial worker stats
      const workerBefore = await User.findById(frontlineWorker._id);
      const initialCompleted = workerBefore?.statistics?.completedJourneys || 0;

      // 5. Start Session
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
          journeyVersionId: journeyVersion._id.toString(),
        },
      });
      expect(createRes.statusCode).toBe(201);
      const sessionId = JSON.parse(createRes.payload).data._id;

      // 6. Complete Session meeting ALL criteria
      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          completedStepIds: ["step_fluid_check", "step_brake_test"],
          durationSeconds: 45,
          quizScore: 90,
          ppeItemsVerified: ["High-Vis Vest", "Steel Toe Boots"],
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const resBody = JSON.parse(completeRes.payload);
      expect(resBody.success).toBe(true);
      expect(resBody.data.status).toBe("completed");
      expect(resBody.data.completedAt).toBeDefined();

      // Checksum must be a valid 64-character SHA-256 HMAC
      const checksum = resBody.data.verificationChecksum;
      expect(checksum).toBeDefined();
      expect(typeof checksum).toBe("string");
      expect(checksum).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(checksum)).toBe(true);

      // Verify Session Document in MongoDB
      const sessionDoc = await KioskSessionModel.findById(sessionId);
      expect(sessionDoc?.status).toBe("completed");
      expect(sessionDoc?.completedAt).toBeInstanceOf(Date);
      expect(sessionDoc?.verificationChecksum).toBe(checksum);
      expect(sessionDoc?.durationSeconds).toBe(45);
      expect(sessionDoc?.quizScore).toBe(90);
      expect(sessionDoc?.completedStepIds).toEqual(
        expect.arrayContaining(["step_fluid_check", "step_brake_test"])
      );

      // Verify Employee User Statistics Update
      const workerAfter = await User.findById(frontlineWorker._id);
      expect(workerAfter?.statistics?.completedJourneys).toBe(initialCompleted + 1);

      // Verify Assignment Record Transition
      const updatedAssignment = await EmployeeAssignment.findById(assignment._id);
      expect(updatedAssignment?.status).toBe("completed");
      expect(updatedAssignment?.completedAt).toBeInstanceOf(Date);

      // Verify Compliance AuditLog
      const auditEntry = await AuditLog.findOne({
        organizationId: testOrg._id,
        eventType: "KIOSK_SESSION_COMPLETED",
        resourceId: sessionDoc?._id,
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.action).toBe("complete");
      expect(auditEntry?.metadata?.verificationChecksum).toBe(checksum);
    });
  });
});
