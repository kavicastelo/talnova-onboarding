import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import {
  KioskSessionModel,
  IKioskSession,
} from "../modules/kiosk/models/kiosk-session.model.js";
import { KioskSessionRepository } from "../modules/kiosk/repositories/kiosk-session.repository.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KIOSK_SESSION_STATUSES } from "../modules/kiosk/types/session.types.js";
import {
  CreateKioskSessionSchema,
  UpdateKioskSessionProgressSchema,
  TransitionKioskSessionStatusSchema,
} from "../modules/kiosk/validation/session.schema.js";

describe("K-FND-003: Kiosk Session Model, Lifecycle & Repository Suite", () => {
  let app: any;
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const supervisorId = new mongoose.Types.ObjectId();
  const repo = new KioskSessionRepository();

  let testDeviceId: mongoose.Types.ObjectId;
  let testJourneyId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test collections
    await KioskSessionModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskDeviceModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskJourneyModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });

    // Ensure model indexes are synchronized
    await KioskSessionModel.syncIndexes();

    // Create a dummy device
    const device = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: `session-test-device-${Date.now()}`,
      name: "Assembly Line Terminal 1",
      location: "Shopfloor Zone A",
      status: "online",
      telemetry: {},
    });
    testDeviceId = device._id as mongoose.Types.ObjectId;

    // Create a dummy journey
    const journey = await KioskJourneyModel.create({
      organizationId: orgAId,
      title: "Chemical Spill Emergency Response",
      languages: ["en"],
      steps: [],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: true,
        security: { protectionType: "none" },
      },
      publishing: { status: "published", version: 1 },
      createdBy: userId,
    });
    testJourneyId = journey._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await KioskSessionModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskDeviceModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskJourneyModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Schema Validation & Default Values", () => {
    it("should insert a new document with status 'active' and empty completedStepIds via createSession", async () => {
      const token = `token-${Date.now()}-${Math.random()}`;
      const session = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: token,
        currentStepId: "step-intro",
      });

      expect(session._id).toBeDefined();
      expect(session.status).toBe("active");
      expect(session.completedStepIds).toEqual([]);
      expect(session.ppeItemsVerified).toEqual([]);
      expect(session.durationSeconds).toBe(0);
      expect(session.versionNumber).toBe(1);
      expect(session.startedAt).toBeInstanceOf(Date);
      expect(session.completedAt).toBeUndefined();
      expect(session.isOfflineSync).toBe(false);
    });

    it("should accept all canonical session status values", async () => {
      const validStatuses = [
        "active",
        "awaiting_supervisor",
        "completed",
        "aborted",
        "timed_out",
      ];
      expect(KIOSK_SESSION_STATUSES).toEqual(validStatuses);

      for (const status of validStatuses) {
        const session = new KioskSessionModel({
          organizationId: orgAId,
          deviceId: testDeviceId,
          journeyId: testJourneyId,
          sessionToken: `token-status-${status}-${Date.now()}-${Math.random()}`,
          status,
        });

        const saved = await session.save();
        expect(saved.status).toBe(status);
      }
    });

    it("should reject an invalid session status string on schema validation", async () => {
      const invalid = new KioskSessionModel({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `token-invalid-${Date.now()}`,
        status: "non_existent_status" as any,
      });

      await expect(invalid.validate()).rejects.toThrow();
    });

    it("should enforce unique sessionToken index", async () => {
      const duplicatedToken = `shared-token-${Date.now()}`;
      await KioskSessionModel.create({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: duplicatedToken,
      });

      const duplicate = new KioskSessionModel({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: duplicatedToken,
      });

      await expect(duplicate.save()).rejects.toThrow(/duplicate key|E11000/i);
    });
  });

  describe("Compound Indexes Verification", () => {
    it("should define expected compound indexes on KioskSessionSchema", () => {
      const indexes = KioskSessionModel.schema.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx[0]).join(","));

      expect(indexKeys).toContain("organizationId,userId,status");
      expect(indexKeys).toContain("organizationId,deviceId,startedAt");
      expect(indexKeys).toContain("organizationId,journeyId,status");
      expect(indexKeys).toContain("sessionToken");
    });
  });

  describe("Step Progress & Atomic Progression", () => {
    it("updateStepProgress should push stepId to completedStepIds without duplicates and advance currentStepId", async () => {
      const session = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `token-prog-${Date.now()}`,
        currentStepId: "step-1",
      });

      // Step 1 completed, duration +15s
      const afterStep1 = await repo.updateStepProgress(session._id, "step-1", 15, orgAId);
      expect(afterStep1).not.toBeNull();
      expect(afterStep1?.currentStepId).toBe("step-1");
      expect(afterStep1?.completedStepIds).toContain("step-1");
      expect(afterStep1?.durationSeconds).toBe(15);

      // Re-visiting step-1 should NOT duplicate in completedStepIds
      const reVisit = await repo.updateStepProgress(session._id, "step-1", 5, orgAId);
      expect(reVisit?.completedStepIds.filter((s) => s === "step-1").length).toBe(1);
      expect(reVisit?.durationSeconds).toBe(20);

      // Advance to step-2, duration +25s
      const afterStep2 = await repo.updateStepProgress(session._id, "step-2", 25, orgAId);
      expect(afterStep2?.currentStepId).toBe("step-2");
      expect(afterStep2?.completedStepIds).toEqual(["step-1", "step-2"]);
      expect(afterStep2?.durationSeconds).toBe(45);
    });
  });

  describe("Status Transitions & Completion Integrity", () => {
    it("transitionStatus to 'completed' should atomically set completedAt and update status", async () => {
      const session = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `token-trans-${Date.now()}`,
        currentStepId: "step-quiz",
      });

      const checksum = crypto
        .createHash("sha256")
        .update(`completion:${session._id}:user:${userId}`)
        .digest("hex");

      const completed = await repo.transitionStatus(
        session._id,
        "completed",
        {
          quizScore: 95,
          ppeItemsVerified: ["respirator", "hazmat_gloves"],
          verificationChecksum: checksum,
        },
        orgAId
      );

      expect(completed).not.toBeNull();
      expect(completed?.status).toBe("completed");
      expect(completed?.completedAt).toBeInstanceOf(Date);
      expect(completed?.quizScore).toBe(95);
      expect(completed?.ppeItemsVerified).toEqual(["respirator", "hazmat_gloves"]);
      expect(completed?.verificationChecksum).toBe(checksum);
    });

    it("transitionStatus to 'awaiting_supervisor' with supervisor witness attestation", async () => {
      const session = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `token-sup-${Date.now()}`,
        currentStepId: "step-gate",
      });

      const witnessed = await repo.transitionStatus(
        session._id,
        "awaiting_supervisor",
        {
          supervisorWitness: {
            supervisorId,
            witnessedAt: new Date(),
            method: "pin",
          },
        },
        orgAId
      );

      expect(witnessed).not.toBeNull();
      expect(witnessed?.status).toBe("awaiting_supervisor");
      expect(witnessed?.supervisorWitness?.supervisorId.toString()).toBe(
        supervisorId.toString()
      );
      expect(witnessed?.supervisorWitness?.method).toBe("pin");
    });
  });

  describe("Tenant Isolation (Multi-Tenancy Guard)", () => {
    it("findByIdAndOrg should return null when querying across tenant boundary", async () => {
      const orgASession = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `token-isolation-${Date.now()}`,
      });

      // Tenant B queries Org A's session
      const crossTenant = await repo.findByIdAndOrg(orgASession._id, orgBId);
      expect(crossTenant).toBeNull();

      // Tenant A queries Org A's session
      const matchingTenant = await repo.findByIdAndOrg(orgASession._id, orgAId);
      expect(matchingTenant).not.toBeNull();
      expect(matchingTenant?._id.toString()).toBe(orgASession._id.toString());
    });
  });

  describe("Validation Schemas Integration", () => {
    it("CreateKioskSessionSchema should validate valid input and reject missing token", () => {
      const valid = {
        deviceId: testDeviceId.toString(),
        journeyId: testJourneyId.toString(),
        sessionToken: "ephemeral-exec-jwt-12345",
        status: "active",
      };
      expect(CreateKioskSessionSchema.safeParse(valid).success).toBe(true);

      const invalid = {
        deviceId: testDeviceId.toString(),
        journeyId: testJourneyId.toString(),
        sessionToken: "",
      };
      expect(CreateKioskSessionSchema.safeParse(invalid).success).toBe(false);
    });

    it("TransitionKioskSessionStatusSchema should validate valid transition payload", () => {
      const payload = {
        status: "completed",
        quizScore: 88,
        ppeItemsVerified: ["safety_boots"],
        verificationChecksum: "sha256-hex-hash",
      };
      expect(TransitionKioskSessionStatusSchema.safeParse(payload).success).toBe(true);
    });
  });

  describe("Regression Check: GET /api/v1/kiosk/sessions/:id Route", () => {
    it("should query KioskSessionModel and return the persisted session document", async () => {
      const persistentSession = await repo.createSession({
        organizationId: orgAId,
        deviceId: testDeviceId,
        journeyId: testJourneyId,
        sessionToken: `route-test-token-${Date.now()}`,
        currentStepId: "step-intro-01",
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/sessions/${persistentSession._id}?organizationId=${orgAId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.payload);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data._id.toString()).toBe(persistentSession._id.toString());
      expect(json.data.status).toBe("active");
      expect(json.data.currentStepId).toBe("step-intro-01");
    });
  });
});
