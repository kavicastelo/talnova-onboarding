import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import KioskJourneyModel from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import { KioskAnalyticsModel } from "../modules/kiosk/models/kiosk-analytics.model.js";
import { KioskDeviceTelemetryModel } from "../modules/kiosk/models/kiosk-device-telemetry.model.js";
import { KioskAnalyticsRepository } from "../modules/kiosk/repositories/kiosk-analytics.repository.js";

describe("K-ANA-001: Analytics, Telemetry & Compliance Architecture Decoupling", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let deviceToken: string;
  let deviceRecord: any;
  let journeyRecord: any;

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();
  const hardwareGuid = `HW-ANA-TEST-${ts}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Analytics Plant A ${ts}`,
      slug: `ana-plant-a-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `analytics-admin-${ts}@talnova.test`,
        passwordHash: "mock_password_hash"
      },
      profile: {
        firstName: "Analyst",
        lastName: "Administrator",
        fullName: "Analyst Administrator"
      },
      role: "admin",
      status: "active"
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      id: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin"
    });

    // 3. Create Paired Kiosk Device
    deviceToken = app.jwt.sign({
      deviceId: hardwareGuid,
      organizationId: testOrg._id.toString(),
      role: "kiosk_device"
    });
    const tokenHash = crypto.createHash("sha256").update(deviceToken).digest("hex");

    deviceRecord = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: hardwareGuid,
      hardwareGuid,
      name: "Warehouse Gate A Kiosk",
      location: "Building 1 - North Entrance",
      deviceType: "wall_mount",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: tokenHash,
      currentContentVersion: 1,
      telemetry: {},
      pendingCommands: [],
      lastSeen: new Date(),
      isDeleted: false
    });

    // 4. Create Kiosk Journey
    journeyRecord = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: `Warehouse Safety Induction ${ts}`,
      description: "Standard warehouse health & safety checklist",
      languages: ["en"],
      createdBy: adminUser._id,
      isDeleted: false,
      steps: [
        {
          id: "step-intro",
          type: "content",
          order: 0,
          title: "Safety Welcome & Orientation",
          isMandatory: true,
          blocks: [{ id: "b1", type: "text", order: 0, content: "Welcome to safety induction." }],
          interaction: { type: "tap_anywhere" }
        },
        {
          id: "step-ppe",
          type: "content",
          order: 1,
          title: "Personal Protective Equipment",
          isMandatory: true,
          blocks: [{ id: "b2", type: "text", order: 0, content: "Confirm PPE checklist." }],
          interaction: { type: "tap_anywhere" }
        },
        {
          id: "step-hazmat",
          type: "content",
          order: 2,
          title: "Dangerous Chemical Protocol",
          isMandatory: true,
          blocks: [{ id: "b3", type: "text", order: 0, content: "Hazmat instructions." }],
          interaction: { type: "tap_anywhere" }
        },
        {
          id: "step-signoff",
          type: "content",
          order: 3,
          title: "Attestation & Signoff",
          isMandatory: true,
          blocks: [{ id: "b4", type: "text", order: 0, content: "Sign off completion." }],
          interaction: { type: "tap_anywhere" }
        }
      ],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: true,
        security: { protectionType: "none" },
        minimumDurationSeconds: 1,
        enforceMandatorySteps: true
      },
      publishing: {
        status: "published",
        version: 1,
        publishedAt: new Date(),
        publishedBy: adminUser._id
      }
    });
  });

  afterAll(async () => {
    await KioskDeviceTelemetryModel.deleteMany({ organizationId: testOrg._id });
    await KioskAnalyticsModel.deleteMany({ organizationId: testOrg._id });
    await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
    if (journeyRecord?._id) {
      await KioskJourneyModel.deleteMany({ _id: journeyRecord._id });
    }
    if (deviceRecord?._id) {
      await KioskDeviceModel.deleteMany({ _id: deviceRecord._id });
    }
    await User.deleteMany({ organizationId: testOrg._id });
    await Organization.deleteMany({ _id: testOrg._id });
    await app.close();
  });

  describe("1. Operational Fleet Telemetry Time-Series & 30-Day TTL (Requirement 1 & Acceptance Criteria 1)", () => {
    it("should declare a 30-day TTL index on KioskDeviceTelemetryModel", async () => {
      const indexes = await KioskDeviceTelemetryModel.collection.indexes();
      const ttlIndex = indexes.find((idx: any) => idx.expireAfterSeconds !== undefined);

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(30 * 24 * 60 * 60); // 2,592,000 seconds = 30 days
      expect(ttlIndex?.key).toHaveProperty("createdAt");
    });

    it("should write a time-series record to KioskDeviceTelemetryModel whenever a heartbeat is received", async () => {
      const countBefore = await KioskDeviceTelemetryModel.countDocuments({
        deviceId: deviceRecord._id
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 1,
          batteryLevel: 88,
          isCharging: true,
          storageUsedBytes: 2147483648,
          storageFreeBytes: 8589934592,
          storageTotalBytes: 10737418240,
          networkLatencyMs: 24,
          screenResolution: "1920x1080",
          orientation: "landscape-primary",
          appVersion: "1.2.0"
        }
      });

      expect(response.statusCode).toBe(200);

      const countAfter = await KioskDeviceTelemetryModel.countDocuments({
        deviceId: deviceRecord._id
      });
      expect(countAfter).toBe(countBefore + 1);

      // Verify the latest recorded telemetry entry
      const latest = await KioskDeviceTelemetryModel.findOne({
        deviceId: deviceRecord._id
      }).sort({ createdAt: -1 });

      expect(latest).not.toBeNull();
      expect(latest?.batteryLevel).toBe(88);
      expect(latest?.isCharging).toBe(true);
      expect(latest?.storageFreeBytes).toBe(8589934592);
      expect(latest?.networkLatencyMs).toBe(24);
      expect(latest?.screenResolution).toBe("1920x1080");
      expect(latest?.appVersion).toBe("1.2.0");
      expect(latest?.hardwareGuid).toBe(hardwareGuid);
      expect(latest?.createdAt).toBeInstanceOf(Date);
    });

    it("should accumulate continuous operational logs across multiple heartbeats without polluting UX analytics", async () => {
      const anaCountBefore = await KioskAnalyticsModel.countDocuments({
        organizationId: testOrg._id
      });

      // Send 2 more heartbeats
      for (let i = 1; i <= 2; i++) {
        await app.inject({
          method: "POST",
          url: "/api/v1/kiosk/devices/heartbeat",
          headers: { authorization: `Bearer ${deviceToken}` },
          payload: {
            currentContentVersion: 1,
            batteryLevel: 88 - i,
            networkLatencyMs: 20 + i
          }
        });
      }

      // Operational telemetry collection has 3 records total
      const telemetryCount = await KioskDeviceTelemetryModel.countDocuments({
        deviceId: deviceRecord._id
      });
      expect(telemetryCount).toBe(3);

      // Product UX analytics collection remained completely untouched by hardware heartbeats
      const anaCountAfter = await KioskAnalyticsModel.countDocuments({
        organizationId: testOrg._id
      });
      expect(anaCountAfter).toBe(anaCountBefore);
    });
  });

  describe("2. Product & UX Analytics 12-Month Retention Tier (Requirement 2)", () => {
    it("should declare a 12-month TTL index on KioskAnalyticsModel", async () => {
      const indexes = await KioskAnalyticsModel.collection.indexes();
      const ttlIndex = indexes.find((idx: any) => idx.expireAfterSeconds !== undefined);

      expect(ttlIndex).toBeDefined();
      expect(ttlIndex?.expireAfterSeconds).toBe(365 * 24 * 60 * 60); // 31,536,000 seconds = 12 months
      expect(ttlIndex?.key).toHaveProperty("createdAt");
    });
  });

  describe("3. GDPR PII Redaction & Worker Privacy (Requirement 4)", () => {
    it("should scrub IP addresses, user IDs, and employee references from analytics records", async () => {
      const repo = new KioskAnalyticsRepository();

      const saved = await repo.saveSession({
        organizationId: testOrg._id,
        journeyId: journeyRecord._id,
        journeyVersion: 1,
        languageUsed: "en",
        dateKey: "2026-10-02",
        metrics: {
          launchesCount: 1,
          completedCount: 1,
          durationSeconds: 120
        },
        // Attacker or legacy client sending PII fields
        ...({
          userId: new mongoose.Types.ObjectId(),
          employeeId: "EMP-SECRET-999",
          workerName: "John Doe",
          ipAddress: "192.168.1.100",
          email: "john.doe@company.com",
          token: "secret-token-xyz"
        } as any)
      });

      expect(saved._id).toBeDefined();

      // Retrieve directly from DB using lean query to verify raw stored document
      const stored = await KioskAnalyticsModel.findById(saved._id).lean();

      expect(stored).not.toBeNull();
      expect((stored as any).userId).toBeUndefined();
      expect((stored as any).employeeId).toBeUndefined();
      expect((stored as any).workerName).toBeUndefined();
      expect((stored as any).ipAddress).toBeUndefined();
      expect((stored as any).email).toBeUndefined();
      expect((stored as any).token).toBeUndefined();
    });
  });

  describe("4. Legal Compliance Records Separation (Requirement 3)", () => {
    it("should maintain legal attestations and compliance tokens exclusively in KioskSessionModel", async () => {
      const session = await KioskSessionModel.create({
        organizationId: testOrg._id,
        deviceId: deviceRecord._id,
        journeyId: journeyRecord._id,
        versionNumber: 1,
        sessionToken: `token-legal-${Date.now()}`,
        status: "completed",
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
        durationSeconds: 300,
        currentStepId: "step-signoff",
        completedStepIds: ["step-intro", "step-ppe", "step-hazmat", "step-signoff"],
        ppeItemsVerified: ["hard_hat", "steel_toe_boots"],
        verificationChecksum: "sha256-verified-legal-signature-anchor",
        supervisorWitness: {
          supervisorId: adminUser._id,
          witnessedAt: new Date(),
          method: "pin"
        },
        isOfflineSync: false
      });

      expect(session._id).toBeDefined();

      // Verify that KioskSessionModel has NO short 30-day or 1-year TTL index (preserves legal records for 3-30 years)
      const sessionIndexes = await KioskSessionModel.collection.indexes();
      const hasTtlIndex = sessionIndexes.some((idx: any) => idx.expireAfterSeconds !== undefined);
      expect(hasTtlIndex).toBe(false);
    });
  });

  describe("5. Aggregated Step Funnel Drop-off Query (Acceptance Criteria 2)", () => {
    beforeAll(async () => {
      const repo = new KioskAnalyticsRepository();

      // Seed realistic UX analytics documents with step drop-offs
      // Session 1: Completed journey through step-signoff
      await repo.saveSession({
        organizationId: testOrg._id,
        journeyId: journeyRecord._id,
        journeyVersion: 1,
        languageUsed: "en",
        dateKey: "2026-10-02",
        metrics: {
          launchesCount: 1,
          completedCount: 1,
          durationSeconds: 150
        },
        interactions: [
          { stepId: "step-intro", elementClicked: "next", dwellTimeSeconds: 25, timestamp: new Date() },
          { stepId: "step-ppe", elementClicked: "next", dwellTimeSeconds: 40, timestamp: new Date() },
          { stepId: "step-hazmat", elementClicked: "next", dwellTimeSeconds: 50, timestamp: new Date() },
          { stepId: "step-signoff", elementClicked: "complete", dwellTimeSeconds: 35, timestamp: new Date() }
        ]
      });

      // Session 2: Dropped off at step-ppe (user aborted / timed out)
      await repo.saveSession({
        organizationId: testOrg._id,
        journeyId: journeyRecord._id,
        journeyVersion: 1,
        languageUsed: "en",
        dateKey: "2026-10-02",
        metrics: {
          launchesCount: 1,
          completedCount: 0,
          durationSeconds: 45,
          abortedStepId: "step-ppe"
        },
        interactions: [
          { stepId: "step-intro", elementClicked: "next", dwellTimeSeconds: 20, timestamp: new Date() },
          { stepId: "step-ppe", elementClicked: "timeout", dwellTimeSeconds: 25, timestamp: new Date() }
        ]
      });

      // Session 3: Dropped off at step-hazmat
      await repo.saveSession({
        organizationId: testOrg._id,
        journeyId: journeyRecord._id,
        journeyVersion: 1,
        languageUsed: "es",
        dateKey: "2026-10-02",
        metrics: {
          launchesCount: 1,
          completedCount: 0,
          durationSeconds: 90,
          abortedStepId: "step-hazmat"
        },
        interactions: [
          { stepId: "step-intro", elementClicked: "next", dwellTimeSeconds: 30, timestamp: new Date() },
          { stepId: "step-ppe", elementClicked: "next", dwellTimeSeconds: 35, timestamp: new Date() },
          { stepId: "step-hazmat", elementClicked: "exit", dwellTimeSeconds: 25, timestamp: new Date() }
        ]
      });
    });

    it("should return aggregated step funnel drop-off stats without exposing individual employee identities", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${journeyRecord._id}/analytics/funnel`,
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.journeyId).toBe(journeyRecord._id.toString());
      expect(body.data.totalSessions).toBeGreaterThanOrEqual(3);
      expect(body.data.totalDropOffs).toBe(2);

      const funnel = body.data.funnel;
      expect(Array.isArray(funnel)).toBe(true);

      // Verify step-intro: 3 views, 0 drop-offs
      const introStep = funnel.find((s: any) => s.stepId === "step-intro");
      expect(introStep).toBeDefined();
      expect(introStep.viewsCount).toBe(3);
      expect(introStep.dropOffCount).toBe(0);

      // Verify step-ppe: 3 views, 1 drop-off
      const ppeStep = funnel.find((s: any) => s.stepId === "step-ppe");
      expect(ppeStep).toBeDefined();
      expect(ppeStep.viewsCount).toBe(3);
      expect(ppeStep.dropOffCount).toBe(1);
      expect(ppeStep.dropOffRate).toBeGreaterThan(0);

      // Verify step-hazmat: 2 views, 1 drop-off
      const hazmatStep = funnel.find((s: any) => s.stepId === "step-hazmat");
      expect(hazmatStep).toBeDefined();
      expect(hazmatStep.viewsCount).toBe(2);
      expect(hazmatStep.dropOffCount).toBe(1);

      // Verify NO PII exists anywhere in the JSON response
      const rawJson = JSON.stringify(body);
      expect(rawJson).not.toContain("EMP-SECRET");
      expect(rawJson).not.toContain("John Doe");
      expect(rawJson).not.toContain("john.doe@company.com");
      expect(rawJson).not.toContain("192.168.1.100");
    });
  });
});
