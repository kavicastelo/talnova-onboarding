import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import crypto from "crypto";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyVersionModel } from "../modules/kiosk/models/kiosk-journey-version.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("K-OFF-003: Idempotent Bulk Synchronization & Conflict Reconciliation Integration Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let foreignOrg: any;
  let frontlineWorker: any;
  let kioskDevice: any;
  let deviceToken: string;
  let journey: any;
  let journeyVersion: any;
  let foreignJourney: any;

  const ts = Date.now();
  const dummyId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Test Organization
    testOrg = await Organization.create({
      name: `Acme Logistics Sync Corp ${ts}`,
      slug: `acme-logistics-sync-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Foreign Organization (for Tenant Boundary test)
    foreignOrg = await Organization.create({
      name: `Foreign Tenant Corp ${ts}`,
      slug: `foreign-tenant-sync-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create Frontline Worker in testOrg
    frontlineWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-sync-${ts}@acme.com`,
        passwordHash: "hashed_pwd_sync",
      },
      profile: {
        firstName: "Elena",
        lastName: "Rostova",
      },
      employment: {
        employeeId: `EMP-SYNC-${ts}`,
        badgeId: `BADGE-SYNC-${ts}`,
        department: "Logistics Terminal",
      },
      role: "frontline_worker_kiosk",
      status: "active",
      statistics: {
        assignedJourneys: 2,
        completedJourneys: 0,
        certificates: 0,
        completionRate: 0,
      },
      isDeleted: false,
    });

    // 4. Create Kiosk Device in testOrg
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-GUID-SYNC-${ts}`,
      hardwareGuid: `HW-GUID-SYNC-${ts}`,
      name: "North Dock Terminal 07",
      location: "Loading Bay North",
      status: "online",
      paired: true,
      lastSeen: new Date(),
    });

    // Generate Kiosk Device JWT
    deviceToken = app.jwt.sign(
      {
        deviceId: kioskDevice.deviceId,
        organizationId: testOrg._id.toString(),
        role: "kiosk_device",
      },
      { expiresIn: "7d" }
    );

    const tokenHash = crypto.createHash("sha256").update(deviceToken).digest("hex");
    await KioskDeviceModel.findByIdAndUpdate(kioskDevice._id, {
      tokenRef: tokenHash,
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });

    // 5. Create Journey in testOrg
    journey = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "Hazardous Chemical Cargo Safety",
      description: "Standard offline cargo safety procedure",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [
        {
          id: "step-intro",
          type: "content",
          order: 0,
          title: "Introduction",
          blocks: [],
          interaction: { type: "confirm" },
        },
        {
          id: "step-ppe",
          type: "content",
          order: 1,
          title: "PPE Verification",
          blocks: [],
          interaction: { type: "ppe_checklist", ppeItems: ["Respirator", "Chemical Gloves"] },
        },
        {
          id: "step-finish",
          type: "content",
          order: 2,
          title: "Completion",
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

    // Create Pinned Journey Version Snapshot
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

    // 6. Create Foreign Journey for Zero-Trust Boundary check
    foreignJourney = await KioskJourneyModel.create({
      organizationId: foreignOrg._id,
      title: "Foreign Isolated Journey",
      languages: ["en"],
      createdBy: dummyId,
      isDeleted: false,
      steps: [],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        security: { protectionType: "none" },
      },
      publishing: { status: "published", version: 1 },
    });
  });

  afterAll(async () => {
    await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [testOrg._id, foreignOrg._id] } });
    await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
    await AuditLog.deleteMany({ organizationId: testOrg._id });
    await User.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteMany({ _id: { $in: [testOrg._id, foreignOrg._id] } });
    await app.close();
  });

  describe("1. Acceptance Criteria 1: 5 Queued Offline Sessions Transmitted & Recorded", () => {
    const offlineBatch: any[] = [];
    const clientSessionIds: string[] = [];

    beforeAll(() => {
      for (let i = 1; i <= 5; i++) {
        const cId = crypto.randomUUID();
        clientSessionIds.push(cId);
        offlineBatch.push({
          clientSessionId: cId,
          journeyId: journey._id.toString(),
          journeyVersionId: journeyVersion._id.toString(),
          versionNumber: 1,
          userId: frontlineWorker._id.toString(),
          deviceId: kioskDevice.deviceId,
          status: "completed",
          startedAt: new Date(Date.now() - 3600000 + i * 60000).toISOString(),
          completedAt: new Date(Date.now() - 3600000 + i * 60000 + 180000).toISOString(),
          durationSeconds: 180 + i * 10,
          currentStepId: "step-finish",
          completedStepIds: ["step-intro", "step-ppe", "step-finish"],
          ppeItemsVerified: ["Respirator", "Chemical Gloves"],
          quizScore: 90 + i,
          verificationChecksum: `sha256-checksum-offline-batch-${i}`,
          isOfflineSync: true,
        });
      }
    });

    it("accepts and records all 5 queued offline sessions upon reconnection", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "content-type": "application/json",
        },
        payload: {
          sessions: offlineBatch,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.syncedCount).toBe(5);
      expect(body.duplicateCount).toBe(0);
      expect(body.failedCount).toBe(0);

      // Verify records stored in KioskSessionModel
      const persisted = await KioskSessionModel.find({
        organizationId: testOrg._id,
        clientSessionId: { $in: clientSessionIds },
      });
      expect(persisted.length).toBe(5);

      for (const session of persisted) {
        expect(session.status).toBe("completed");
        expect(session.isOfflineSync).toBe(true);
        expect(session.userId?.toString()).toBe(frontlineWorker._id.toString());
        expect(session.completedStepIds).toEqual(["step-intro", "step-ppe", "step-finish"]);
        expect(session.ppeItemsVerified).toEqual(["Respirator", "Chemical Gloves"]);
      }
    });

    it("creates completion audit log entries in AuditLog collection", async () => {
      const auditEntries = await AuditLog.find({
        organizationId: testOrg._id,
        eventType: "KIOSK_OFFLINE_SESSION_SYNCED",
      });

      expect(auditEntries.length).toBe(5);
      for (const entry of auditEntries) {
        expect(entry.action).toBe("complete");
        expect(entry.resourceType).toBe("KioskSession");
        expect(entry.metadata?.isOfflineSync).toBe(true);
        expect(clientSessionIds).toContain(entry.metadata?.clientSessionId);
      }
    });

    it("updates employee onboarding roadmap progress on completion", async () => {
      const updatedWorker = await User.findById(frontlineWorker._id);
      expect(updatedWorker).toBeDefined();
      expect(updatedWorker?.statistics?.completedJourneys).toBe(5);
    });
  });

  describe("2. Acceptance Criteria 2: Idempotent Re-transmission (Duplicate Reconciliation)", () => {
    it("recognizes duplicate clientSessionIds and returns 200 OK with duplicateCount: 5 on second submission", async () => {
      // Re-query the 5 existing sessions
      const existingSessions = await KioskSessionModel.find({
        organizationId: testOrg._id,
      });
      expect(existingSessions.length).toBe(5);

      const retryBatch = existingSessions.map((s) => ({
        clientSessionId: s.clientSessionId,
        journeyId: s.journeyId.toString(),
        userId: s.userId?.toString(),
        status: "completed",
        durationSeconds: s.durationSeconds,
        quizScore: s.quizScore,
        isOfflineSync: true,
      }));

      // Submit identical batch a second time (simulating client retry after network glitch)
      const retryResponse = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "content-type": "application/json",
        },
        payload: {
          sessions: retryBatch,
        },
      });

      expect(retryResponse.statusCode).toBe(200);
      const body = retryResponse.json();

      expect(body.success).toBe(true);
      expect(body.syncedCount).toBe(0);
      expect(body.duplicateCount).toBe(5);
      expect(body.failedCount).toBe(0);

      // Crucial assertion: ZERO duplicate records created in KioskSessionModel
      const finalCount = await KioskSessionModel.countDocuments({
        organizationId: testOrg._id,
      });
      expect(finalCount).toBe(5);
    });
  });

  describe("3. Partial Conflict Reconciliation (Mixed Batch)", () => {
    it("correctly reconciles mixed batch containing 3 duplicates and 2 brand-new sessions", async () => {
      const existingSessions = await KioskSessionModel.find({
        organizationId: testOrg._id,
      }).limit(3);

      const mixedBatch: any[] = [];

      // 3 existing duplicates
      for (const s of existingSessions) {
        mixedBatch.push({
          clientSessionId: s.clientSessionId,
          journeyId: s.journeyId.toString(),
          status: "completed",
          durationSeconds: s.durationSeconds,
        });
      }

      // 2 brand-new sessions
      const newId1 = crypto.randomUUID();
      const newId2 = crypto.randomUUID();

      mixedBatch.push({
        clientSessionId: newId1,
        journeyId: journey._id.toString(),
        status: "completed",
        durationSeconds: 210,
        quizScore: 98,
      });

      mixedBatch.push({
        clientSessionId: newId2,
        journeyId: journey._id.toString(),
        status: "completed",
        durationSeconds: 220,
        quizScore: 100,
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "content-type": "application/json",
        },
        payload: {
          sessions: mixedBatch,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body.success).toBe(true);
      expect(body.syncedCount).toBe(2);
      expect(body.duplicateCount).toBe(3);
      expect(body.failedCount).toBe(0);

      const totalCount = await KioskSessionModel.countDocuments({
        organizationId: testOrg._id,
      });
      expect(totalCount).toBe(7); // 5 previous + 2 new
    });
  });

  describe("4. Zero Trust Tenant Boundary Isolation", () => {
    it("rejects sync attempt containing a foreign tenant's journeyId with 403 TENANT_MISMATCH", async () => {
      const crossTenantBatch = [
        {
          clientSessionId: crypto.randomUUID(),
          journeyId: foreignJourney._id.toString(), // Belongs to foreignOrg
          status: "completed",
        },
      ];

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "content-type": "application/json",
        },
        payload: {
          sessions: crossTenantBatch,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.code).toBe("TENANT_MISMATCH");
    });
  });
});
