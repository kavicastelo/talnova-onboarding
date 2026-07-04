import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import {
  KioskJourneyModel,
  KioskDeviceModel,
  KioskAnalyticsModel,
  KioskJourneyRepository,
  KioskDeviceRepository,
  KioskAnalyticsRepository
} from "../modules/kiosk/index.js";

describe("Kiosk Persistence & Repository Integration Tests", () => {
  let app: any;
  const orgId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  
  const journeyRepo = new KioskJourneyRepository();
  const deviceRepo = new KioskDeviceRepository();
  const analyticsRepo = new KioskAnalyticsRepository();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    
    // Clear any test kiosk documents
    await KioskJourneyModel.deleteMany({ organizationId: orgId });
    await KioskDeviceModel.deleteMany({ organizationId: orgId });
    await KioskAnalyticsModel.deleteMany({ organizationId: orgId });
  });

  afterAll(async () => {
    // Cleanup
    await KioskJourneyModel.deleteMany({ organizationId: orgId });
    await KioskDeviceModel.deleteMany({ organizationId: orgId });
    await KioskAnalyticsModel.deleteMany({ organizationId: orgId });
    
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("KioskJourney Repository Operations", () => {
    let journeyId: mongoose.Types.ObjectId;

    it("should successfully create a new kiosk journey", async () => {
      const journey = await journeyRepo.create({
        organizationId: orgId,
        title: "Test Warehouse Safety",
        description: "Emergency paths and safety drills onboarding kiosk journey.",
        languages: ["en", "es"],
        steps: [
          {
            id: "step_1",
            type: "instruction_step",
            title: "Wear Safety Glasses",
            order: 0,
            blocks: [
              {
                id: "b1",
                type: "icon",
                order: 0,
                mediaReferences: {},
                settings: {
                  iconName: "safety_glasses",
                  size: "large",
                  theme: "warning"
                }
              }
            ],
            interaction: {
              type: "tap_to_continue"
            }
          }
        ],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 45,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: {
            protectionType: "none"
          }
        },
        publishing: {
          status: "draft",
          version: 1
        },
        createdBy: userId,
        isDeleted: false
      });

      expect(journey._id).toBeDefined();
      expect(journey.title).toBe("Test Warehouse Safety");
      expect(journey.publishing.status).toBe("draft");
      journeyId = journey._id as mongoose.Types.ObjectId;
    });

    it("should find the created journey by id", async () => {
      const found = await journeyRepo.findById(journeyId);
      expect(found).not.toBeNull();
      expect(found?.title).toBe("Test Warehouse Safety");
    });

    it("should find the journey by id and organization identity", async () => {
      const found = await journeyRepo.findByIdAndOrg(journeyId, orgId);
      expect(found).not.toBeNull();
    });

    it("should list journeys for an organization with pagination", async () => {
      const { journeys, total } = await journeyRepo.find({ organizationId: orgId }, { page: 1, limit: 10 });
      expect(total).toBe(1);
      expect(journeys[0].title).toBe("Test Warehouse Safety");
    });

    it("should successfully update a kiosk journey", async () => {
      const updated = await journeyRepo.update(journeyId, { title: "Updated Warehouse Safety" } as any, userId);
      expect(updated).not.toBeNull();
      expect(updated?.title).toBe("Updated Warehouse Safety");
      expect(updated?.updatedBy?.toString()).toBe(userId.toString());
    });

    it("should publish a kiosk journey and increment version", async () => {
      const published = await journeyRepo.publish(journeyId, userId);
      expect(published).not.toBeNull();
      expect(published?.publishing.status).toBe("published");
      expect(published?.publishing.version).toBe(2);
      expect(published?.publishing.publishedAt).toBeDefined();
    });

    it("should soft delete the kiosk journey", async () => {
      const deleted = await journeyRepo.softDelete(journeyId, userId);
      expect(deleted).not.toBeNull();
      expect(deleted?.isDeleted).toBe(true);
      expect(deleted?.deletedAt).toBeDefined();

      const searchAgain = await journeyRepo.findById(journeyId);
      expect(searchAgain).toBeNull();
    });
  });

  describe("KioskDevice Repository Operations", () => {
    const hardwareGuid = "kiosk-hw-fingerprint-999";
    let deviceId: mongoose.Types.ObjectId;
    let journeyId: mongoose.Types.ObjectId;

    beforeAll(async () => {
      // Create a dummy journey to link
      const journey = await journeyRepo.create({
        organizationId: orgId,
        title: "Terminal Linked Journey",
        languages: ["en"],
        steps: [],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" }
        },
        publishing: { status: "draft", version: 1 },
        createdBy: userId,
        isDeleted: false
      });
      journeyId = journey._id as mongoose.Types.ObjectId;
    });

    it("should successfully register a new kiosk terminal device", async () => {
      const device = await deviceRepo.register({
        organizationId: orgId,
        deviceId: hardwareGuid,
        name: "Lobby Front Desk Terminal",
        location: "Building Lobby",
        status: "offline",
        telemetry: {},
        currentContentVersion: 1
      });

      expect(device._id).toBeDefined();
      expect(device.deviceId).toBe(hardwareGuid);
      expect(device.status).toBe("offline");
      deviceId = device._id as mongoose.Types.ObjectId;
    });

    it("should find the device by its hardware fingerprint identity", async () => {
      const found = await deviceRepo.findByFingerprint(hardwareGuid);
      expect(found).not.toBeNull();
      expect(found?.name).toBe("Lobby Front Desk Terminal");
    });

    it("should update device telemetry and status on heartbeat", async () => {
      const heartbeatTime = new Date();
      const updated = await deviceRepo.heartbeat(deviceId, 2, {
        batteryLevel: 0.95,
        isCharging: true,
        storageFreeBytes: 5000000,
        appVersion: "1.0.2",
        networkLatencyMs: 12
      });

      expect(updated).not.toBeNull();
      expect(updated?.status).toBe("online");
      expect(updated?.currentContentVersion).toBe(2);
      expect(updated?.telemetry.batteryLevel).toBe(0.95);
      expect(updated?.telemetry.isCharging).toBe(true);
      expect(updated?.lastSeen.getTime()).toBeGreaterThanOrEqual(heartbeatTime.getTime());
    });

    it("should pair the device to a kiosk journey", async () => {
      const paired = await deviceRepo.pairJourney(deviceId, journeyId);
      expect(paired).not.toBeNull();
      expect(paired?.currentJourneyId?.toString()).toBe(journeyId.toString());
    });

    it("should filter and list devices with pagination", async () => {
      const { devices, total } = await deviceRepo.find({ organizationId: orgId, status: "online" }, { page: 1, limit: 10 });
      expect(total).toBe(1);
      expect(devices[0].name).toBe("Lobby Front Desk Terminal");
    });
  });

  describe("KioskAnalytics Repository Operations", () => {
    let journeyId: mongoose.Types.ObjectId;
    let deviceObjectId: mongoose.Types.ObjectId;

    beforeAll(async () => {
      const journey = await KioskJourneyModel.create({
        organizationId: orgId,
        title: "Warehouse Analytics Target",
        languages: ["en", "pt"],
        steps: [],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 60,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: { protectionType: "none" }
        },
        publishing: { status: "published", version: 1 },
        createdBy: userId,
        isDeleted: false
      });
      journeyId = journey._id as mongoose.Types.ObjectId;

      const device = await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: "analytics-kiosk-test-hw-fingerprint",
        name: "Analytics Test Terminal",
        location: "Kiosk Hallway",
        status: "online",
        telemetry: {},
        currentContentVersion: 1
      });
      deviceObjectId = device._id as mongoose.Types.ObjectId;
    });

    it("should successfully save a single analytics session log", async () => {
      const log = await analyticsRepo.saveSession({
        organizationId: orgId,
        deviceId: deviceObjectId,
        journeyId: journeyId,
        journeyVersion: 1,
        languageUsed: "en",
        metrics: {
          launchesCount: 1,
          completedCount: 1,
          durationSeconds: 120
        },
        interactions: [
          {
            stepId: "step_1",
            elementClicked: "next",
            timestamp: new Date()
          }
        ],
        dateKey: "2026-07-03"
      });

      expect(log._id).toBeDefined();
      expect(log.languageUsed).toBe("en");
      expect(log.metrics.launchesCount).toBe(1);
    });

    it("should bulk sync offline cached sessions", async () => {
      const sessions = [
        {
          organizationId: orgId,
          deviceId: deviceObjectId,
          journeyId: journeyId,
          journeyVersion: 1,
          languageUsed: "en",
          metrics: {
            launchesCount: 1,
            completedCount: 0,
            durationSeconds: 30,
            abortedStepId: "step_2"
          },
          interactions: [],
          dateKey: "2026-07-03"
        },
        {
          organizationId: orgId,
          deviceId: deviceObjectId,
          journeyId: journeyId,
          journeyVersion: 1,
          languageUsed: "pt",
          metrics: {
            launchesCount: 1,
            completedCount: 1,
            durationSeconds: 90
          },
          interactions: [
            {
              stepId: "step_1",
              elementClicked: "yes",
              timestamp: new Date()
            }
          ],
          dateKey: "2026-07-03"
        }
      ];

      const inserted = await analyticsRepo.bulkSync(sessions as any[]);
      expect(inserted.length).toBe(2);
      expect(inserted[0].metrics.launchesCount).toBe(1);
    });

    it("should aggregate logs and generate summary reports", async () => {
      const summary = await analyticsRepo.getSummary(orgId, journeyId, "2026-07-01", "2026-07-05");
      expect(summary.totalLaunches).toBe(3);
      expect(summary.totalCompletions).toBe(2);
      expect(summary.sessionsCount).toBe(3);
      expect(summary.completionRate).toBeCloseTo(66.66, 1);
      expect(summary.averageDurationSeconds).toBe((120 + 30 + 90) / 3);
      expect(summary.languagesUsed).toContain("en");
      expect(summary.languagesUsed).toContain("pt");

      expect(summary.languageBreakdown.find((l: any) => l.language === "en").count).toBe(2);
      expect(summary.languageBreakdown.find((l: any) => l.language === "pt").count).toBe(1);
    });
  });
});
