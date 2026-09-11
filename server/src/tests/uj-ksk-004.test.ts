import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskAnalyticsModel } from "../modules/kiosk/models/kiosk-analytics.model.js";

describe("Journey Test UJ-KSK-004: Kiosk Device Heartbeat & Analytics Sync", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let deviceToken: string;
  let expiredDeviceToken: string;
  let employeeToken: string;
  let testJourney: any;
  let testDevice: any;

  const testDeviceId = "TEST-KIOSK-001";
  const journeyCode = "kiosk-jrn-01";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Kiosk Sync Org ${ts}`,
      slug: `kiosk-sync-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `kiosk-sync-admin-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Sync",
        lastName: "Admin",
      },
      employment: {
        department: "IT Operations",
        jobTitle: "Terminal Supervisor",
        status: "active",
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

    // 3. Create Regular Employee User
    const employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `kiosk-sync-emp-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Line",
        lastName: "Operator",
      },
      employment: {
        department: "Factory Floor",
        jobTitle: "Worker",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create Published Kiosk Journey with journeyCode "kiosk-jrn-01"
    testJourney = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      title: "Assembly Floor Safety Onboarding",
      description: "PPE & Operational Briefing",
      journeyCode,
      status: "published",
      languages: ["en"],
      steps: [
        {
          id: "step-01",
          type: "standard_step",
          title: "PPE Gear Verification",
          order: 0,
          blocks: [
            {
              id: "b-01",
              type: "text",
              order: 0,
              mediaReferences: { en: { textValue: "Verify your safety helmet and goggles." } },
            },
          ],
          interaction: { type: "tap_to_continue" },
        },
      ],
      publishing: {
        status: "published",
        publishedAt: new Date(),
        version: 1,
      },
      settings: {
        security: { pinCode: "1234" },
        timeoutSeconds: 120,
        allowedLanguages: ["en"],
        defaultLanguage: "en",
      },
    });

    // 5. Create Paired Kiosk Device
    await KioskDeviceModel.deleteMany({ deviceId: testDeviceId });
    testDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: testDeviceId,
      hardwareGuid: testDeviceId,
      name: "Assembly Floor Terminal",
      location: "Building 3",
      status: "online",
      paired: true,
      currentJourneyId: testJourney._id,
      currentContentVersion: 1,
      lastSeen: new Date(Date.now() - 3600000), // 1 hour ago
      lastHeartbeatAt: new Date(Date.now() - 3600000),
      telemetry: {},
    });

    // 6. Generate Device Token
    deviceToken = app.jwt.sign(
      {
        deviceId: testDeviceId,
        organizationId: testOrg._id.toString(),
        role: "kiosk_device",
      },
      { expiresIn: "365d" }
    );

    // 7. Generate Expired Device Token
    const nowSec = Math.floor(Date.now() / 1000);
    expiredDeviceToken = app.jwt.sign({
      deviceId: testDeviceId,
      organizationId: testOrg._id.toString(),
      role: "kiosk_device",
      iat: nowSec - 7200,
      exp: nowSec - 3600,
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await KioskAnalyticsModel.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
  });

  it("Step 1-2: Terminal transmits telemetry heartbeat ping (POST /api/v1/kiosk/devices/heartbeat)", async () => {
    const beforeTime = Date.now();

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/heartbeat",
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        batteryLevel: 88,
        appVersion: "1.4.2",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe("ok");

    // Verify MongoDB KioskDevice was updated with lastHeartbeatAt and online status
    const updatedDevice = await KioskDeviceModel.findOne({ deviceId: testDeviceId });
    expect(updatedDevice).toBeDefined();
    expect(updatedDevice?.status).toBe("online");
    expect(updatedDevice?.lastHeartbeatAt).toBeDefined();
    expect(new Date(updatedDevice!.lastHeartbeatAt!).getTime()).toBeGreaterThanOrEqual(beforeTime - 2000);
    expect(updatedDevice?.telemetry?.batteryLevel).toBe(0.88);
    expect(updatedDevice?.telemetry?.appVersion).toBe("1.4.2");
  });

  it("Step 3-4: Terminal uploads buffered analytics events (POST /api/v1/kiosk/analytics/sync)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/analytics/sync",
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        events: [
          {
            journeyId: journeyCode,
            stepId: "step-01",
            eventType: "STEP_VIEWED",
            durationSeconds: 30,
          },
          {
            journeyId: journeyCode,
            stepId: "step-01",
            eventType: "PPE_COMPLETED",
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.syncedCount).toBe(2);
  });

  it("Step 5 & Data Integrity: MongoDB kioskanalytics collection contains 2 new records", async () => {
    const records = await KioskAnalyticsModel.find({
      organizationId: testOrg._id,
      journeyId: testJourney._id,
    }).sort({ createdAt: 1 });

    expect(records.length).toBe(2);

    const stepViewedRecord = records.find((r) => r.eventType === "STEP_VIEWED");
    expect(stepViewedRecord).toBeDefined();
    expect(stepViewedRecord?.stepId).toBe("step-01");
    expect(stepViewedRecord?.metrics.durationSeconds).toBe(30);
    expect(stepViewedRecord?.metrics.launchesCount).toBe(1);

    const ppeCompletedRecord = records.find((r) => r.eventType === "PPE_COMPLETED");
    expect(ppeCompletedRecord).toBeDefined();
    expect(ppeCompletedRecord?.stepId).toBe("step-01");
    expect(ppeCompletedRecord?.metrics.completedCount).toBe(1);
  });

  it("Alternative Path: Missing device token is rejected with HTTP 401 Unauthorized", async () => {
    const heartbeatResp = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/heartbeat",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        batteryLevel: 88,
      },
    });
    expect(heartbeatResp.statusCode).toBe(401);

    const syncResp = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/analytics/sync",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        events: [
          { journeyId: journeyCode, stepId: "step-01", eventType: "STEP_VIEWED" },
        ],
      },
    });
    expect(syncResp.statusCode).toBe(401);
  });

  it("Negative Test: Send malformed event structure (missing eventType) rejects with HTTP 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/analytics/sync",
      headers: {
        Authorization: `Bearer ${deviceToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        events: [
          {
            journeyId: journeyCode,
            stepId: "step-01",
            // eventType is missing!
            durationSeconds: 30,
          },
        ],
      },
    });

    expect([400, 422]).toContain(response.statusCode);
  });

  it("Authorization Test: Expired device token rejected with HTTP 401 Unauthorized", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/heartbeat",
      headers: {
        Authorization: `Bearer ${expiredDeviceToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        batteryLevel: 85,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it("Authorization Test: Standard employee token rejected on heartbeat endpoint with HTTP 403 Forbidden", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/heartbeat",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        batteryLevel: 90,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Integration Checks: Analytics summary reflects updated completion counts", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/kiosk/journeys/${testJourney._id}/analytics`,
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.totalCompletions).toBeGreaterThanOrEqual(1);
    expect(body.data.totalLaunches).toBeGreaterThanOrEqual(2);
  });
});
