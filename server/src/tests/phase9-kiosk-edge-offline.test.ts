import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import DocumentTemplate from "../modules/documents/models/document-template.model.js";
import DocumentAssignment from "../modules/documents/models/document-assignment.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import Assignment from "../modules/assignments/models/assignment.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import KioskService from "../modules/kiosk/services/kiosk.service.js";
import KioskDeviceRepository from "../modules/kiosk/repositories/kiosk-device.repository.js";
import KioskJourneyRepository from "../modules/kiosk/repositories/kiosk-journey.repository.js";
import KioskAnalyticsRepository from "../modules/kiosk/repositories/kiosk-analytics.repository.js";
import KioskSecurityService from "../modules/kiosk/services/kiosk-security.service.js";

describe("Phase 9 — Frontline Kiosk Edge Architecture & PWA Offline Reconciliation", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let supervisorUser: any;
  let frontlineWorker: any;
  let kioskDevice: any;
  let staleKioskDevice: any;

  let docTemplate: any;
  let docAssignment: any;
  let journey: any;
  let assignment: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Frontline Logistics Corp",
      slug: `frontline-logistics-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-${ts}@logistics.com`,
        passwordHash: "hashed_pass_123",
      },
      profile: {
        firstName: "Sarah",
        lastName: "Administrator",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Frontline Warehouse Supervisor
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `supervisor-${ts}@logistics.com`,
        passwordHash: "hashed_pass_123",
      },
      profile: {
        firstName: "Marcus",
        lastName: "Supervisor",
      },
      permissions: {
        role: "manager",
      },
      employment: {
        badgeId: `SUP-${ts}`,
        jobTitle: "Warehouse Shift Supervisor",
      },
    });

    // 4. Create Pre-boarding Frontline Worker (no corporate email yet, identifies via badgeId / nationalId)
    frontlineWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-${ts}@logistics.com`,
        passwordHash: "temp_hash_frontline",
      },
      profile: {
        firstName: "Devon",
        lastName: "Frontline",
      },
      permissions: {
        role: "employee",
      },
      employment: {
        badgeId: `BADGE-${ts}`,
        nationalId: `NIC-${ts}`,
        jobTitle: "Material Handler",
        department: "Operations",
      },
    });

    // 5. Create Kiosk Devices
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      name: "Dock 4 Preboarding Terminal",
      deviceId: `DEV-KIOSK-${ts}-01`,
      location: "Warehouse Bay A",
      status: "online",
      telemetry: {
        batteryLevel: 0.98,
        storageFreeBytes: 50000000000,
        networkLatencyMs: 15,
        appVersion: "v1.2.0",
      },
      lastHeartbeatAt: new Date(),
      lastSeen: new Date(),
    });

    staleKioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      name: "Gate 2 Entrance Kiosk",
      deviceId: `DEV-KIOSK-${ts}-02`,
      location: "Gate 2 Entrance",
      status: "online",
      telemetry: {
        batteryLevel: 0.45,
        storageFreeBytes: 30000000000,
        networkLatencyMs: 85,
        appVersion: "v1.1.0",
      },
      // Stale heartbeat: 45 minutes ago
      lastHeartbeatAt: new Date(Date.now() - 45 * 60 * 1000),
      lastSeen: new Date(Date.now() - 45 * 60 * 1000),
    });

    // 6. Create Mandatory Compliance Document & Assignment for Frontline Worker
    docTemplate = await DocumentTemplate.create({
      organizationId: testOrg._id,
      title: "Warehouse Floor Safety & Liability Agreement",
      category: "code_of_conduct",
      content: "<p>I agree to follow all warehouse safety regulations and PPE rules.</p>",
      fields: [
        {
          id: "sig_1",
          type: "signature",
          label: "Worker Signature",
          required: true,
          pageNumber: 1,
        },
      ],
      createdBy: adminUser._id,
      version: 1,
      isDeleted: false,
    });

    docAssignment = await DocumentAssignment.create({
      organizationId: testOrg._id,
      templateId: docTemplate._id,
      templateTitle: docTemplate.title,
      templateVersion: 1,
      employeeId: frontlineWorker._id,
      assignedBy: adminUser._id,
      assignedAt: new Date(),
      status: "pending",
      fields: [],
      isDeleted: false,
    });

    // 7. Create Learning Journey & Assignment for PWA Offline Reconciliation
    journey = await Journey.create({
      organizationId: testOrg._id,
      title: "Forklift Safety & Material Handling Basics",
      slug: `forklift-safety-${ts}`,
      description: "Mandatory material handling training for frontline operators",
      modules: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Forklift Operational Basics",
          order: 1,
          lessons: [
            {
              _id: new mongoose.Types.ObjectId(),
              title: "Pre-Operation Equipment Inspection",
              order: 1,
              contentBlocks: [],
              completionRules: { requireContentCompletion: false, requireQuizCompletion: false },
            },
            {
              _id: new mongoose.Types.ObjectId(),
              title: "Safe Load Stacking & Cornering",
              order: 2,
              contentBlocks: [],
              completionRules: { requireContentCompletion: false, requireQuizCompletion: false },
            },
          ],
        },
      ],
      publishing: { status: "published", version: 1 },
      createdBy: adminUser._id,
      isDeleted: false,
    });

    const mod0 = journey.modules[0];
    assignment = await Assignment.create({
      organizationId: testOrg._id,
      employeeId: frontlineWorker._id,
      assignedBy: adminUser._id,
      journey: {
        journeyId: journey._id,
        title: journey.title,
        version: 1,
      },
      assignment: {
        assignedAt: new Date(),
        priority: "normal",
      },
      status: "assigned",
      progress: {
        totalModules: 1,
        completedModules: 0,
        totalLessons: 2,
        completedLessons: 0,
        completionPercentage: 0,
        totalTimeSpentSeconds: 0,
      },
      modules: [
        {
          moduleId: mod0._id,
          title: mod0.title,
          completed: false,
          lessons: [
            {
              lessonId: mod0.lessons[0]._id,
              title: mod0.lessons[0].title,
              status: "not_started",
              timeSpentSeconds: 0,
              contentBlocks: [],
            },
            {
              lessonId: mod0.lessons[1]._id,
              title: mod0.lessons[1].title,
              status: "not_started",
              timeSpentSeconds: 0,
              contentBlocks: [],
            },
          ],
        },
      ],
      completedLessonIds: [],
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await Organization.deleteOne({ _id: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await DocumentTemplate.deleteMany({ organizationId: testOrg._id });
      await DocumentAssignment.deleteMany({ organizationId: testOrg._id });
      await Journey.deleteMany({ organizationId: testOrg._id });
      await Assignment.deleteMany({ organizationId: testOrg._id });
    }
    await app.close();
  });

  // =========================================================================
  // TEST 1: Frontline Ephemeral Identification & Session Token Generation
  // =========================================================================
  it("1. should identify frontline worker via badgeId / nationalId and issue ephemeral session token", async () => {
    // A. Identify via Badge ID
    const resBadge = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: `BADGE-${ts}`,
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(resBadge.statusCode).toBe(200);
    const badgeBody = JSON.parse(resBadge.payload);
    expect(badgeBody.success).toBe(true);
    expect(badgeBody.data.token).toBeDefined();
    expect(badgeBody.data.user.id).toBe(frontlineWorker._id.toString());
    expect(badgeBody.data.user.badgeId).toBe(`BADGE-${ts}`);
    expect(badgeBody.data.pendingComplianceDocsCount).toBe(1);

    // Verify ephemeral token contents
    const decoded = app.jwt.decode<any>(badgeBody.data.token);
    expect(decoded.role).toBe("frontline_worker_kiosk");
    expect(decoded.scope).toBe("kiosk_preboarding_execution");
    expect(decoded.userId).toBe(frontlineWorker._id.toString());
    expect(decoded.kioskDeviceId).toBe(kioskDevice._id.toString());

    // B. Identify via National ID
    const resNational = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: `NIC-${ts}`,
      },
    });
    expect(resNational.statusCode).toBe(200);
    const natBody = JSON.parse(resNational.payload);
    expect(natBody.data.user.id).toBe(frontlineWorker._id.toString());

    // C. Negative Test: Unknown identifier
    const resNotFound = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/identify",
      payload: {
        identifier: "NON_EXISTENT_BADGE_99999",
      },
    });
    expect(resNotFound.statusCode).toBe(404);
  });

  // =========================================================================
  // TEST 2: Supervisor PIN Management & Verification
  // =========================================================================
  it("2. should allow setting and verifying supervisor 4-digit PIN", async () => {
    // A. Admin sets 4-digit supervisor PIN
    const resSetPin = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/supervisor/pin",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        supervisorId: supervisorUser._id.toString(),
        pin: "4826",
      },
    });
    expect(resSetPin.statusCode).toBe(200);

    // Verify PIN is securely hashed in User model
    const updatedSup = await User.findById(supervisorUser._id);
    expect(updatedSup?.security?.supervisorPinHash).toBeDefined();
    const expectedHash = crypto.createHash("sha256").update("4826").digest("hex");
    expect(updatedSup?.security?.supervisorPinHash).toBe(expectedHash);

    // B. Verify correct supervisor PIN
    const resVerify = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/supervisor/verify-pin",
      payload: {
        supervisorIdentifier: `SUP-${ts}`,
        pin: "4826",
      },
    });
    expect(resVerify.statusCode).toBe(200);
    const verifyBody = JSON.parse(resVerify.payload);
    expect(verifyBody.data.verified).toBe(true);
    expect(verifyBody.data.supervisor.id).toBe(supervisorUser._id.toString());

    // C. Negative Test: Incorrect PIN
    const resBadPin = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/supervisor/verify-pin",
      payload: {
        supervisorIdentifier: `SUP-${ts}`,
        pin: "0000",
      },
    });
    expect(resBadPin.statusCode).toBe(401);
  });

  // =========================================================================
  // TEST 3: UQ-01 Resolution: Frontline Document Execution with Supervisor Co-Signature
  // =========================================================================
  it("3. should resolve UQ-01: allow frontline worker to sign legal compliance document with supervisor PIN co-signature", async () => {
    // Generate fresh ephemeral token for frontline worker at kiosk
    const kioskSessionToken = app.jwt.sign(
      {
        userId: frontlineWorker._id.toString(),
        organizationId: testOrg._id.toString(),
        role: "frontline_worker_kiosk",
        scope: "kiosk_preboarding_execution",
        kioskDeviceId: kioskDevice._id.toString(),
      },
      { expiresIn: "1h" }
    );

    // A. Negative Test: Frontline kiosk token attempting to sign without supervisor co-signature PIN
    const resFailWithoutSupervisor = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${docAssignment._id}/sign`,
      headers: { authorization: `Bearer ${kioskSessionToken}` },
      payload: {
        type: "draw",
        signerName: "Devon Frontline",
        signatureDataUrl: "data:image/png;base64,devon_signature_stroke",
      },
    });
    expect(resFailWithoutSupervisor.statusCode).toBe(403);
    const failBody = JSON.parse(resFailWithoutSupervisor.payload);
    expect(failBody.message).toContain("Supervisor PIN authorization is required");

    // B. Negative Test: Invalid supervisor PIN
    const resFailWrongPin = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${docAssignment._id}/sign`,
      headers: { authorization: `Bearer ${kioskSessionToken}` },
      payload: {
        type: "draw",
        signerName: "Devon Frontline",
        signatureDataUrl: "data:image/png;base64,devon_signature_stroke",
        supervisorWitnessId: supervisorUser._id.toString(),
        supervisorPin: "9999",
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });
    expect(resFailWrongPin.statusCode).toBe(401);

    // C. Success Test: Valid supervisor PIN co-signature
    const resSignSuccess = await app.inject({
      method: "POST",
      url: `/api/v1/documents/${docAssignment._id}/sign`,
      headers: { authorization: `Bearer ${kioskSessionToken}` },
      payload: {
        type: "draw",
        signerName: "Devon Frontline",
        signatureDataUrl: "data:image/png;base64,devon_signature_stroke",
        supervisorWitnessId: supervisorUser._id.toString(),
        supervisorPin: "4826",
        kioskDeviceId: kioskDevice._id.toString(),
      },
    });

    expect(resSignSuccess.statusCode).toBe(200);
    const signBody = JSON.parse(resSignSuccess.payload);
    expect(signBody.success).toBe(true);
    expect(signBody.data.status).toBe("signed");

    // Verify database record has supervisorWitnessId, kioskDeviceId, and tamper-evident SHA256
    const updatedAssignment = await DocumentAssignment.findById(docAssignment._id);
    expect(updatedAssignment?.status).toBe("signed");
    expect(updatedAssignment?.signatureData?.supervisorWitnessId?.toString()).toBe(supervisorUser._id.toString());
    expect(updatedAssignment?.signatureData?.kioskDeviceId?.toString()).toBe(kioskDevice._id.toString());
    expect(updatedAssignment?.signatureData?.sha256Hash).toBeDefined();
    expect(updatedAssignment?.signatureData?.notes).toContain("witnessed & co-signed at frontline kiosk");
  });

  // =========================================================================
  // TEST 4: PWA Resilient Batch Reconciliation Protocol
  // =========================================================================
  it("4. should reconcile offline learning progress batch deterministically, retaining earliest timestamps", async () => {
    const frontlineAuthToken = app.jwt.sign({
      userId: frontlineWorker._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    const lesson0Id = journey.modules[0].lessons[0]._id.toString();
    const lesson1Id = journey.modules[0].lessons[1]._id.toString();

    const pastTimestamp1 = new Date(Date.now() - 3600000); // 1 hour ago
    const pastTimestamp2 = new Date(Date.now() - 1800000); // 30 minutes ago

    // A. Submit offline batch completions
    const batchPayload = {
      batchCompletions: [
        {
          lessonId: lesson0Id,
          completedAt: pastTimestamp1.toISOString(),
          clientTransactionId: "tx_offline_001",
        },
      ],
    };

    const resSync1 = await app.inject({
      method: "POST",
      url: `/api/v1/assignments/${assignment._id}/progress`,
      headers: { authorization: `Bearer ${frontlineAuthToken}` },
      payload: batchPayload,
    });

    expect(resSync1.statusCode).toBe(200);
    const sync1Body = JSON.parse(resSync1.payload);
    expect(sync1Body.success).toBe(true);
    expect(sync1Body.reconciledCount).toBe(1);
    expect(sync1Body.currentProgress).toBe(50); // 1 of 2 lessons completed

    // Check DB state
    let checkAssignment = await Assignment.findById(assignment._id);
    let l0 = checkAssignment?.modules[0].lessons.find((l: any) => l.lessonId.toString() === lesson0Id);
    expect(l0?.status).toBe("completed");
    expect(new Date(l0?.completedAt!).toISOString()).toBe(pastTimestamp1.toISOString());

    // B. Idempotent Re-sync with a LATER timestamp (should retain the EARLIER timestamp)
    const laterTimestamp = new Date();
    const resResync = await app.inject({
      method: "POST",
      url: `/api/v1/assignments/${assignment._id}/progress`,
      headers: { authorization: `Bearer ${frontlineAuthToken}` },
      payload: {
        batchCompletions: [
          {
            lessonId: lesson0Id,
            completedAt: laterTimestamp.toISOString(),
            clientTransactionId: "tx_offline_001_dup",
          },
        ],
      },
    });

    expect(resResync.statusCode).toBe(200);
    checkAssignment = await Assignment.findById(assignment._id);
    l0 = checkAssignment?.modules[0].lessons.find((l: any) => l.lessonId.toString() === lesson0Id);
    // Verified: Retained earliest timestamp!
    expect(new Date(l0?.completedAt!).toISOString()).toBe(pastTimestamp1.toISOString());

    // C. Reconcile second lesson -> 100% completion
    const resSync2 = await app.inject({
      method: "POST",
      url: `/api/v1/assignments/${assignment._id}/progress`,
      headers: { authorization: `Bearer ${frontlineAuthToken}` },
      payload: {
        batchCompletions: [
          {
            lessonId: lesson1Id,
            completedAt: pastTimestamp2.toISOString(),
            clientTransactionId: "tx_offline_002",
          },
        ],
      },
    });

    expect(resSync2.statusCode).toBe(200);
    const sync2Body = JSON.parse(resSync2.payload);
    expect(sync2Body.currentProgress).toBe(100);

    checkAssignment = await Assignment.findById(assignment._id);
    expect(checkAssignment?.status).toBe("completed");
    expect(checkAssignment?.modules[0].completed).toBe(true);

    // D. Verify PWA test fixture handler (assign-pwa-01) supports batchCompletions
    const resPwaFixture = await app.inject({
      method: "POST",
      url: "/api/v1/assignments/assign-pwa-01/progress",
      headers: { authorization: `Bearer ${frontlineAuthToken}` },
      payload: {
        batchCompletions: [
          { lessonId: "les-pwa-02", completedAt: new Date().toISOString(), clientTransactionId: "pwa_fix_1" },
        ],
      },
    });
    expect(resPwaFixture.statusCode).toBe(200);
    const fixBody = JSON.parse(resPwaFixture.payload);
    expect(fixBody.data.completionPercentage).toBe(100);
  });

  // =========================================================================
  // TEST 5: Autonomous Kiosk Fleet Health Sentinel
  // =========================================================================
  it("5. should detect stale terminal heartbeats and autonomously transition them to offline", async () => {
    const kioskService = new KioskService(
      new KioskJourneyRepository(),
      new KioskDeviceRepository(),
      new KioskAnalyticsRepository(),
      new KioskSecurityService()
    );

    // Verify initial states
    const initialFresh = await KioskDeviceModel.findById(kioskDevice._id);
    const initialStale = await KioskDeviceModel.findById(staleKioskDevice._id);
    expect(initialFresh?.status).toBe("online");
    expect(initialStale?.status).toBe("online");

    // Execute fleet health sentinel scan
    const staleDetected = await kioskService.scanKioskFleetHealth(testOrg._id.toString());
    expect(staleDetected.offlineCount).toBeGreaterThanOrEqual(1);

    const foundStale = staleDetected.flaggedDevices.find((d: any) => d.deviceId === staleKioskDevice.deviceId);
    expect(foundStale).toBeDefined();

    // Verify terminal status mutated in DB
    const freshAfter = await KioskDeviceModel.findById(kioskDevice._id);
    const staleAfter = await KioskDeviceModel.findById(staleKioskDevice._id);
    expect(freshAfter?.status).toBe("online");
    expect(staleAfter?.status).toBe("offline");
  });

  // =========================================================================
  // TEST 6: Manual Maintenance Mode Guardrail
  // =========================================================================
  it("6. should support manual Maintenance Mode toggle and enforce operational isolation", async () => {
    // A. Admin toggles kiosk into Maintenance Mode
    const resMaintOn = await app.inject({
      method: "PATCH",
      url: `/api/v1/kiosk/devices/${kioskDevice._id}/maintenance`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { maintenance: true },
    });

    expect(resMaintOn.statusCode).toBe(200);
    const maintOnBody = JSON.parse(resMaintOn.payload);
    expect(maintOnBody.data.status).toBe("maintenance");

    const inDbMaint = await KioskDeviceModel.findById(kioskDevice._id);
    expect(inDbMaint?.status).toBe("maintenance");

    // B. Admin toggles kiosk out of Maintenance Mode back to Online
    const resMaintOff = await app.inject({
      method: "PATCH",
      url: `/api/v1/kiosk/devices/${kioskDevice._id}/maintenance`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { maintenance: false },
    });

    expect(resMaintOff.statusCode).toBe(200);
    const maintOffBody = JSON.parse(resMaintOff.payload);
    expect(maintOffBody.data.status).toBe("online");

    const inDbRestored = await KioskDeviceModel.findById(kioskDevice._id);
    expect(inDbRestored?.status).toBe("online");
  });
});
