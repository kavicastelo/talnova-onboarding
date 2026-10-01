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

describe("K-EMP-002: Kiosk Session Lifecycle State Machine Backend Integration Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let frontlineWorker: any;
  let workerToken: string;
  let kioskDevice: any;
  let journey: any;
  let journeyVersion: any;
  let witnessJourney: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Acme Industrial Logistics",
      slug: `acme-industrial-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Frontline Worker
    frontlineWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-${ts}@acme.com`,
        passwordHash: "hashed_pwd_worker",
      },
      profile: {
        firstName: "Marcus",
        lastName: "Vance",
      },
      employment: {
        employeeId: `EMP-${ts}`,
        badgeId: `BADGE-${ts}`,
        department: "Operations Bay",
      },
      role: "frontline_worker_kiosk",
      status: "active",
      isDeleted: false,
    });

    // 3. Create Kiosk Device
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-GUID-LIFECYCLE-${ts}`,
      hardwareGuid: `HW-GUID-LIFECYCLE-${ts}`,
      name: "Assembly Bay 4 Terminal",
      location: "Sector B Loading Dock",
      status: "online",
      isPaired: true,
      lastSeen: new Date(),
    });

    // 4. Create Standard Safety Journey
    journey = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "Warehouse Forklift & Dock Safety",
      description: "Standard operational safety procedure",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [
        {
          id: "step_dock_rules",
          type: "content",
          order: 0,
          title: "Dock Loading Rules",
          blocks: [],
          interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
        },
        {
          id: "step_ppe_check",
          type: "content",
          order: 1,
          title: "PPE Verification",
          blocks: [],
          interaction: { type: "ppe_checklist", ppeItems: ["Hard Hat", "Safety Glasses"] },
        },
        {
          id: "step_sign_off",
          type: "content",
          order: 2,
          title: "Final Confirmation",
          blocks: [],
          interaction: { type: "hold_to_confirm", holdDurationMs: 1000 },
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

    // 5. Create Pinned Journey Version Snapshot
    journeyVersion = await KioskJourneyVersionModel.create({
      organizationId: testOrg._id,
      journeyId: journey._id,
      version: 1,
      title: journey.title,
      description: journey.description,
      languages: journey.languages,
      steps: journey.steps,
      settings: journey.settings,
      contentChecksum: "sha256-dummy-steps-checksum",
      publishedBy: frontlineWorker._id,
      publishedAt: new Date(),
      status: "published",
    });

    // 6. Create Journey Requiring Supervisor Witness
    witnessJourney = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "Hazardous Chemical Handling",
      description: "Strict compliance requiring supervisor attestation",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [
        {
          id: "step_chem_1",
          type: "content",
          order: 0,
          title: "Chemical Handling",
          blocks: [],
          interaction: { type: "hold_to_confirm", holdDurationMs: 1000, requireSupervisorWitness: true },
          requireSupervisorWitness: true,
        },
      ],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        requireSupervisorWitness: true,
        security: {
          protectionType: "none",
          requireSupervisorWitness: true,
        },
      },
      publishing: {
        status: "published",
        version: 1,
        publishedAt: new Date(),
      },
    });

    // 7. Issue Frontline Worker Ephemeral Token via /identify
    const resIdentify = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: `BADGE-${ts}`,
        kioskDeviceId: kioskDevice.deviceId,
      },
    });
    expect(resIdentify.statusCode).toBe(200);
    const identifyBody = JSON.parse(resIdentify.payload);
    workerToken = identifyBody.data.token;
  });

  afterAll(async () => {
    if (testOrg) {
      await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteMany({ _id: testOrg._id });
    }
    await app.close();
  });

  // =========================================================================
  // 1. Session Instantiation (Acceptance Criteria 1 & Requirement 1, 2, 3)
  // =========================================================================
  describe("POST /api/v1/kiosk/sessions (Session Instantiation)", () => {
    it("creates an active KioskSession bound to verified frontline worker userId when workerToken is provided", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: {
          authorization: `Bearer ${workerToken}`,
        },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
          journeyVersionId: journeyVersion._id.toString(),
          versionNumber: 1,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data._id).toBeDefined();
      expect(body.data.status).toBe("active");
      expect(body.data.sessionToken).toBeDefined();

      // Verify MongoDB document state
      const doc = await KioskSessionModel.findById(body.data._id);
      expect(doc).not.toBeNull();
      expect(doc?.status).toBe("active");
      expect(doc?.userId?.toString()).toBe(frontlineWorker._id.toString());
      expect(doc?.journeyVersionId?.toString()).toBe(journeyVersion._id.toString());
      expect(doc?.completedStepIds).toEqual([]);
      expect(doc?.durationSeconds).toBe(0);
    });

    it("creates an anonymous KioskSession with userId null/undefined when in public mode", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
          userId: null,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("active");

      // Verify userId is null in MongoDB
      const doc = await KioskSessionModel.findById(body.data._id);
      expect(doc?.userId).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Step Progress Updates (Acceptance Criteria 2 & Requirement 4)
  // =========================================================================
  describe("PATCH /api/v1/kiosk/sessions/:id/progress", () => {
    it("records completed step ID in completedStepIds and updates currentStepId when navigating forward", async () => {
      // Create session first
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/sessions",
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          deviceId: kioskDevice.deviceId,
          journeyId: journey._id.toString(),
          currentStepId: "step_dock_rules",
        },
      });
      const sessionId = JSON.parse(createRes.payload).data._id;

      // User navigates from Step 1 ('step_dock_rules') to Step 2 ('step_ppe_check')
      const progressRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/kiosk/sessions/${sessionId}/progress`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          currentStepId: "step_ppe_check",
          completedStepId: "step_dock_rules",
          durationSeconds: 15,
        },
      });

      expect(progressRes.statusCode).toBe(200);
      const body = JSON.parse(progressRes.payload);
      expect(body.data.currentStepId).toBe("step_ppe_check");
      expect(body.data.completedStepIds).toContain("step_dock_rules");
      expect(body.data.durationSeconds).toBe(15);

      // Verify in MongoDB
      const updatedDoc = await KioskSessionModel.findById(sessionId);
      expect(updatedDoc?.currentStepId).toBe("step_ppe_check");
      expect(updatedDoc?.completedStepIds).toContain("step_dock_rules");
    });
  });

  // =========================================================================
  // 3. Server-Authoritative Completion Transitions
  // =========================================================================
  describe("POST /api/v1/kiosk/sessions/:id/complete", () => {
    it("transitions standard session to 'completed' and sets completedAt timestamp", async () => {
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

      const completeRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/complete`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          durationSeconds: 95,
          ppeItemsVerified: ["Hard Hat", "Safety Glasses"],
        },
      });

      expect(completeRes.statusCode).toBe(200);
      const body = JSON.parse(completeRes.payload);
      expect(body.data.status).toBe("completed");
      expect(body.data.completedAt).toBeDefined();

      const doc = await KioskSessionModel.findById(sessionId);
      expect(doc?.status).toBe("completed");
      expect(doc?.completedAt).toBeInstanceOf(Date);
      expect(doc?.durationSeconds).toBe(95);
    });

    it("transitions to 'awaiting_supervisor' if journey requires supervisor co-signature", async () => {
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
        payload: {},
      });

      expect(completeRes.statusCode).toBe(200);
      const body = JSON.parse(completeRes.payload);
      expect(body.data.status).toBe("awaiting_supervisor");

      const doc = await KioskSessionModel.findById(sessionId);
      expect(doc?.status).toBe("awaiting_supervisor");
      expect(doc?.completedAt).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. Session Abort Transitions (Acceptance Criteria 3)
  // =========================================================================
  describe("POST /api/v1/kiosk/sessions/:id/abort", () => {
    it("transitions session to 'aborted' when worker restarts or exits journey", async () => {
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

      const abortRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/sessions/${sessionId}/abort`,
        headers: { authorization: `Bearer ${workerToken}` },
        payload: {
          abortedStepId: "step_dock_rules",
          reason: "Worker restarted session",
          durationSeconds: 22,
        },
      });

      expect(abortRes.statusCode).toBe(200);
      const body = JSON.parse(abortRes.payload);
      expect(body.data.status).toBe("aborted");

      const doc = await KioskSessionModel.findById(sessionId);
      expect(doc?.status).toBe("aborted");
      expect(doc?.durationSeconds).toBe(22);
    });
  });
});
