import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { User } from "../modules/auth/models/user.model.js";
import {
  KioskJourneyModel,
  KioskDeviceModel,
  KioskAnalyticsModel
} from "../modules/kiosk/index.js";

describe("Kiosk API Integration Concurrent Load & Tenant Isolation Tests (Phase 7)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminAToken: string;
  let journeyAId: mongoose.Types.ObjectId;
  let journeyBId: mongoose.Types.ObjectId;

  // Track devices to test concurrently
  const CONCURRENT_DEVICE_COUNT = 50;
  const devicesData: Array<{
    deviceId: string;
    token: string;
    modelId: string;
  }> = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Seed organizations
    const orgA = await Organization.create({
      name: "Load Org A",
      slug: "load-org-a",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Load Org B",
      slug: "load-org-b",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Clean old test objects for these specific organizations
    await User.deleteMany({ "auth.email": "load-admin-a@test.com" });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskAnalyticsModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

    // Seed admin for Org A
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: { email: "load-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Load", lastName: "Admin" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminAToken = app.jwt.sign({
      userId: adminAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "admin"
    });

    // Seed Journeys
    const journeyA = await KioskJourneyModel.create({
      organizationId: orgAId,
      title: "Org A Core Onboarding",
      languages: ["en", "es"],
      steps: [
        {
          id: "step_1",
          type: "instruction_step",
          title: "Safety Rules Overview",
          order: 0,
          blocks: [],
          interaction: { type: "tap_to_continue" }
        },
        {
          id: "step_2",
          type: "instruction_step",
          title: "Hazard Areas Warning",
          order: 1,
          blocks: [],
          interaction: { type: "tap_to_continue" }
        }
      ],
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
      createdBy: adminAUser._id,
      isDeleted: false
    });
    journeyAId = journeyA._id as mongoose.Types.ObjectId;

    const journeyB = await KioskJourneyModel.create({
      organizationId: orgBId,
      title: "Org B Secret Guide",
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
      publishing: { status: "published", version: 1 },
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    journeyBId = journeyB._id as mongoose.Types.ObjectId;

    // Seed devices and sign tokens
    const devicesToCreate = [];
    for (let i = 0; i < CONCURRENT_DEVICE_COUNT; i++) {
      const hwId = `load-hw-terminal-${i}`;
      devicesToCreate.push({
        organizationId: orgAId,
        deviceId: hwId,
        name: `Terminal Terminal #${i}`,
        location: `Section ${i % 5}`,
        status: "offline",
        telemetry: {},
        currentContentVersion: 1,
        pairedAt: new Date(),
        lastSeen: new Date()
      });

      const token = app.jwt.sign({
        deviceId: hwId,
        organizationId: orgAId.toString(),
        role: "kiosk_device"
      });

      devicesData.push({
        deviceId: hwId,
        token,
        modelId: ""
      });
    }

    const createdDocs = await KioskDeviceModel.insertMany(devicesToCreate);
    createdDocs.forEach((doc, idx) => {
      devicesData[idx].modelId = doc._id.toString();
    });
  }, 60000);

  afterAll(async () => {
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ _id: adminAUser._id });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskAnalyticsModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

    await app.close();
    await disconnectDatabase(app.log);
  });

  it("should handle heavy concurrent device heartbeats without locks or failures", async () => {
    const startTime = Date.now();

    // Fire all heartbeats concurrently using the app.inject router
    const heartbeatPromises = devicesData.map((dev, index) => {
      const telemetry = {
        currentContentVersion: 1,
        telemetry: {
          batteryLevel: 0.9 - (index * 0.01),
          isCharging: index % 2 === 0,
          storageFreeBytes: 2 * 1024 * 1024 * 1024,
          appVersion: "1.2.0",
          networkLatencyMs: 10 + index
        }
      };

      return app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${dev.token}` },
        payload: telemetry
      });
    });

    const responses = await Promise.all(heartbeatPromises);
    const duration = Date.now() - startTime;
    const avgResponseTime = duration / CONCURRENT_DEVICE_COUNT;

    // Output load statistics to runner logs
    app.log.info(`[LOAD TEST] Concurrently processed ${CONCURRENT_DEVICE_COUNT} heartbeats in ${duration}ms. Avg: ${avgResponseTime.toFixed(2)}ms/req`);

    // Verify all returned 200 OK
    responses.forEach((res) => {
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    // Check database to ensure telemetry and status were updated correctly
    const onlineCount = await KioskDeviceModel.countDocuments({
      organizationId: orgAId,
      status: "online"
    });
    expect(onlineCount).toBe(CONCURRENT_DEVICE_COUNT);

    const checkDevice = await KioskDeviceModel.findOne({ deviceId: devicesData[0].deviceId });
    expect(checkDevice?.telemetry?.batteryLevel).toBe(0.9);
  });

  it("should handle heavy concurrent offline analytics sync logs without key collisions", async () => {
    const startTime = Date.now();

    // Fire all analytics batch sync uploads concurrently
    const syncPromises = devicesData.map((dev) => {
      const syncPayload = {
        sessions: [
          {
            journeyId: journeyAId.toString(),
            journeyVersion: 1,
            languageUsed: "en",
            metrics: {
              launchesCount: 1,
              completedCount: 1,
              durationSeconds: 40
            },
            interactions: [
              { stepId: "step_1", elementClicked: "next", timestamp: new Date().toISOString() }
            ],
            dateKey: "2026-07-03"
          },
          {
            journeyId: journeyAId.toString(),
            journeyVersion: 1,
            languageUsed: "es",
            metrics: {
              launchesCount: 1,
              completedCount: 0,
              durationSeconds: 20,
              abortedStepId: "step_2"
            },
            interactions: [],
            dateKey: "2026-07-03"
          }
        ]
      };

      return app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: { authorization: `Bearer ${dev.token}` },
        payload: syncPayload
      });
    });

    const responses = await Promise.all(syncPromises);
    const duration = Date.now() - startTime;
    const avgResponseTime = duration / CONCURRENT_DEVICE_COUNT;

    app.log.info(`[LOAD TEST] Concurrently processed ${CONCURRENT_DEVICE_COUNT} analytics batch uploads in ${duration}ms. Avg: ${avgResponseTime.toFixed(2)}ms/req`);

    // Verify all returned 200 OK
    responses.forEach((res) => {
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    // Verify that N * 2 analytics session documents are stored
    const totalAnalyticsCount = await KioskAnalyticsModel.countDocuments({
      organizationId: orgAId
    });
    expect(totalAnalyticsCount).toBe(CONCURRENT_DEVICE_COUNT * 2);

    // Verify that admin analytics reports aggregate all records correctly
    const summaryRes = await app.inject({
      method: "GET",
      url: `/api/v1/kiosk/journeys/${journeyAId.toString()}/analytics`,
      headers: { authorization: `Bearer ${adminAToken}` }
    });

    expect(summaryRes.statusCode).toBe(200);
    const summaryBody = JSON.parse(summaryRes.payload);
    expect(summaryBody.success).toBe(true);

    const summary = summaryBody.data;
    expect(summary.totalLaunches).toBe(CONCURRENT_DEVICE_COUNT * 2);
    expect(summary.totalCompletions).toBe(CONCURRENT_DEVICE_COUNT);
    expect(summary.completionRate).toBe(50);
  });

  it("should enforce strict tenant isolation boundaries under concurrent load", async () => {
    // Attempt 1: Upload analytics logs referencing Org B's journey using Org A's device token
    const devToken = devicesData[0].token;
    const invalidSyncPayload = {
      sessions: [
        {
          journeyId: journeyBId.toString(), // Belongs to Org B
          journeyVersion: 1,
          languageUsed: "en",
          metrics: {
            launchesCount: 1,
            completedCount: 1,
            durationSeconds: 10
          },
          interactions: [],
          dateKey: "2026-07-03"
        }
      ]
    };

    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/analytics/sync",
      headers: { authorization: `Bearer ${devToken}` },
      payload: invalidSyncPayload
    });

    // Should reject because device trying to upload session for a journey outside its tenant
    expect(res1.statusCode).toBe(400);

    // Attempt 2: Query Org B's journey analytics using Org A's admin credentials
    const res2 = await app.inject({
      method: "GET",
      url: `/api/v1/kiosk/journeys/${journeyBId.toString()}/analytics`,
      headers: { authorization: `Bearer ${adminAToken}` }
    });

    // Should reject / return 404 Not Found to prevent leaking existence of other tenants
    expect(res2.statusCode).toBe(404);
  });
});
