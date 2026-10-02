import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskEmergencyModel } from "../modules/kiosk/models/kiosk-emergency.model.js";
import { KioskDeviceHeartbeatSchema } from "../modules/kiosk/validation/device.schema.js";

describe("K-DEV-005: Enhanced Kiosk Device Heartbeat & Telemetry Protocol", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let otherOrg: any;
  let adminUser: any;
  let adminToken: string;
  let deviceToken: string;
  let deviceRecord: any;
  let otherDeviceToken: string;
  let otherDeviceRecord: any;

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();
  const hardwareGuidA = `HW-TELEMETRY-A-${ts}`;
  const hardwareGuidB = `HW-TELEMETRY-B-${ts}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization A
    testOrg = await Organization.create({
      name: `Telemetry Plant A ${ts}`,
      slug: `plant-a-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // 2. Create Organization B
    otherOrg = await Organization.create({
      name: `Telemetry Plant B ${ts}`,
      slug: `plant-b-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // 3. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `telemetry-admin-${ts}@plant.test`,
        passwordHash: "mock_password_hash"
      },
      profile: {
        firstName: "Marcus",
        lastName: "TelemetryAdmin",
        fullName: "Marcus TelemetryAdmin"
      },
      employment: {
        employeeId: `EMP-TLM-${ts}`,
        badgeId: `BADGE-TLM-${ts}`,
        jobTitle: "Kiosk Telemetry Operations Lead",
        hireDate: new Date()
      },
      role: "admin",
      status: "active"
    });

    adminToken = app.jwt.sign(
      {
        userId: adminUser._id.toString(),
        organizationId: testOrg._id.toString(),
        role: "admin"
      },
      { expiresIn: "1h" }
    );

    // 4. Create Paired Device in Org A
    deviceToken = app.jwt.sign(
      {
        deviceId: hardwareGuidA,
        organizationId: testOrg._id.toString(),
        role: "kiosk_device"
      },
      { expiresIn: "24h" }
    );
    const tokenHashA = crypto.createHash("sha256").update(deviceToken).digest("hex");

    deviceRecord = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: hardwareGuidA,
      hardwareGuid: hardwareGuidA,
      name: "Gate 1 Telemetry Kiosk",
      location: "Main Entrance",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: tokenHashA,
      currentContentVersion: 1,
      telemetry: {
        batteryLevel: 90,
        isCharging: true,
        storageUsedBytes: 1048576,
        storageFreeBytes: 10485760,
        storageTotalBytes: 11534336,
        networkLatencyMs: 15,
        screenResolution: "1920x1080",
        orientation: "landscape-primary",
        appVersion: "1.0.0"
      },
      pendingCommands: []
    });

    // 5. Create Paired Device in Org B
    otherDeviceToken = app.jwt.sign(
      {
        deviceId: hardwareGuidB,
        organizationId: otherOrg._id.toString(),
        role: "kiosk_device"
      },
      { expiresIn: "24h" }
    );
    const tokenHashB = crypto.createHash("sha256").update(otherDeviceToken).digest("hex");

    otherDeviceRecord = await KioskDeviceModel.create({
      organizationId: otherOrg._id,
      deviceId: hardwareGuidB,
      hardwareGuid: hardwareGuidB,
      name: "Plant B Kiosk",
      location: "Warehouse Loading",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: tokenHashB,
      currentContentVersion: 1,
      telemetry: {},
      pendingCommands: []
    });
  });

  afterAll(async () => {
    await KioskDeviceModel.deleteMany({ _id: { $in: [deviceRecord._id, otherDeviceRecord._id] } });
    await User.deleteMany({ _id: adminUser._id });
    await Organization.deleteMany({ _id: { $in: [testOrg._id, otherOrg._id] } });
    await KioskEmergencyModel.deleteMany({ organizationId: testOrg._id });
    await app.close();
  });

  describe("Requirement 1: Schema Validation (KioskDeviceHeartbeatSchema)", () => {
    it("should accept comprehensive hardware health telemetry payload", () => {
      const validPayload = {
        currentContentVersion: 2,
        batteryLevel: 88,
        isCharging: true,
        storageUsedBytes: 2500000000,
        storageFreeBytes: 3500000000,
        storageTotalBytes: 6000000000,
        networkLatencyMs: 24,
        screenResolution: "1920x1080",
        orientation: "landscape-primary",
        appVersion: "1.2.0"
      };

      const result = KioskDeviceHeartbeatSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batteryLevel).toBe(88);
        expect(result.data.storageTotalBytes).toBe(6000000000);
        expect(result.data.screenResolution).toBe("1920x1080");
        expect(result.data.orientation).toBe("landscape-primary");
      }
    });

    it("should accept nested telemetry object conforming to KioskTelemetrySchema", () => {
      const nestedPayload = {
        currentContentVersion: 3,
        telemetry: {
          batteryLevel: 0.92,
          isCharging: false,
          storageUsedBytes: 1200000,
          storageFreeBytes: 8800000,
          storageTotalBytes: 10000000,
          networkLatencyMs: 18,
          screenResolution: "1080x1920",
          orientation: "portrait",
          appVersion: "1.2.0"
        }
      };

      const result = KioskDeviceHeartbeatSchema.safeParse(nestedPayload);
      expect(result.success).toBe(true);
    });

    it("should reject negative latency or negative storage values", () => {
      const invalidPayload = {
        telemetry: {
          storageUsedBytes: -500
        }
      };

      const result = KioskDeviceHeartbeatSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });

    it("should reject battery level greater than 100", () => {
      const invalidPayload = {
        batteryLevel: 150
      };

      const result = KioskDeviceHeartbeatSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Requirement 2 & Acceptance Criteria: Heartbeat Telemetry Persistence & Server Contract", () => {
    it("should update hardware health metrics on KioskDeviceModel and return { success, serverTime, commands }", async () => {
      const beforeTime = Date.now();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 4,
          batteryLevel: 76,
          isCharging: true,
          storageUsedBytes: 3100000000,
          storageFreeBytes: 4900000000,
          storageTotalBytes: 8000000000,
          networkLatencyMs: 31,
          screenResolution: "2560x1440",
          orientation: "landscape-primary",
          appVersion: "2.0.0"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      // Verify Contract
      expect(body.success).toBe(true);
      expect(typeof body.serverTime).toBe("number");
      expect(body.serverTime).toBeGreaterThanOrEqual(beforeTime);
      expect(Array.isArray(body.commands)).toBe(true);

      // Verify Database Persistence on KioskDeviceModel
      const updatedInDb = await KioskDeviceModel.findById(deviceRecord._id);
      expect(updatedInDb).not.toBeNull();
      expect(updatedInDb?.currentContentVersion).toBe(4);
      expect(updatedInDb?.telemetry.batteryLevel).toBe(76);
      expect(updatedInDb?.telemetry.isCharging).toBe(true);
      expect(updatedInDb?.telemetry.storageUsedBytes).toBe(3100000000);
      expect(updatedInDb?.telemetry.storageFreeBytes).toBe(4900000000);
      expect(updatedInDb?.telemetry.storageTotalBytes).toBe(8000000000);
      expect(updatedInDb?.telemetry.networkLatencyMs).toBe(31);
      expect(updatedInDb?.telemetry.screenResolution).toBe("2560x1440");
      expect(updatedInDb?.telemetry.orientation).toBe("landscape-primary");
      expect(updatedInDb?.telemetry.appVersion).toBe("2.0.0");
      expect(updatedInDb?.status).toBe("online");
    });
  });

  describe("Requirement 2: Bidirectional Command Polling via Heartbeat", () => {
    it("should allow an admin to queue a command for the device and deliver it on the next heartbeat", async () => {
      // 1. Admin queues RELOAD_MANIFEST command
      const queueResponse = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          type: "RELOAD_MANIFEST",
          payload: { reason: "Content manifest updated", targetVersion: 5 }
        }
      });

      expect(queueResponse.statusCode).toBe(201);
      const queueBody = JSON.parse(queueResponse.payload);
      expect(queueBody.success).toBe(true);
      expect(queueBody.command.type).toBe("RELOAD_MANIFEST");
      expect(queueBody.command.status).toBe("pending");

      // Verify command is in pendingCommands array in DB
      const devicePreHeartbeat = await KioskDeviceModel.findById(deviceRecord._id);
      const pendingCmd = devicePreHeartbeat?.pendingCommands?.find(
        (c: any) => c.type === "RELOAD_MANIFEST" && c.status === "pending"
      );
      expect(pendingCmd).toBeDefined();

      // 2. Terminal executes heartbeat ping
      const heartbeatResponse = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 4,
          networkLatencyMs: 14
        }
      });

      expect(heartbeatResponse.statusCode).toBe(200);
      const heartbeatBody = JSON.parse(heartbeatResponse.payload);

      // Verify queued command is delivered in heartbeat commands array
      expect(heartbeatBody.commands).toBeDefined();
      const deliveredCmd = heartbeatBody.commands.find((c: any) => c.type === "RELOAD_MANIFEST");
      expect(deliveredCmd).toBeDefined();
      expect(deliveredCmd.payload.reason).toBe("Content manifest updated");

      // 3. Verify status in database transitioned to 'dispatched'
      const devicePostHeartbeat = await KioskDeviceModel.findById(deviceRecord._id);
      const dispatchedCmd = devicePostHeartbeat?.pendingCommands?.find((c: any) => c.id === deliveredCmd.id);
      expect(dispatchedCmd?.status).toBe("dispatched");
      expect(dispatchedCmd?.dispatchedAt).toBeDefined();

      // 4. Subsequent heartbeat should no longer deliver the already-dispatched command
      const nextHeartbeatResp = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 5
        }
      });

      expect(nextHeartbeatResp.statusCode).toBe(200);
      const nextHeartbeatBody = JSON.parse(nextHeartbeatResp.payload);
      const staleCmd = nextHeartbeatBody.commands.find((c: any) => c.id === deliveredCmd.id);
      expect(staleCmd).toBeUndefined();
    });

    it("should deliver multiple queued commands (e.g. ENTER_MAINTENANCE and CLEAR_CACHE)", async () => {
      // Queue ENTER_MAINTENANCE
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord.deviceId}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "ENTER_MAINTENANCE", payload: { scheduledDurationMinutes: 30 } }
      });

      // Queue CLEAR_CACHE
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord.deviceId}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "CLEAR_CACHE", payload: { forceStoragePurge: true } }
      });

      // Terminal heartbeats
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${deviceToken}` },
        payload: { currentContentVersion: 5 }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.commands.length).toBeGreaterThanOrEqual(2);

      const maintenanceCmd = body.commands.find((c: any) => c.type === "ENTER_MAINTENANCE");
      const clearCacheCmd = body.commands.find((c: any) => c.type === "CLEAR_CACHE");

      expect(maintenanceCmd).toBeDefined();
      expect(clearCacheCmd).toBeDefined();
    });
  });

  describe("Emergency Override Heartbeat Delivery", () => {
    it("should include emergency_override command in heartbeat when active emergency exists", async () => {
      // Create active emergency in Org A
      const emergency = await KioskEmergencyModel.create({
        organizationId: testOrg._id,
        type: "weather",
        title: "SEVERE WEATHER TORNADO WARNING",
        message: "Seek designated shelter immediately.",
        severity: "critical",
        status: "active",
        triggeredBy: dummyAdminId,
        triggeredAt: new Date()
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${deviceToken}` },
        payload: { currentContentVersion: 5 }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      const emergencyCmd = body.commands.find((c: any) => c.type === "emergency_override");
      expect(emergencyCmd).toBeDefined();
      expect(emergencyCmd.payload.title).toBe("SEVERE WEATHER TORNADO WARNING");

      // Cleanup emergency
      await KioskEmergencyModel.deleteOne({ _id: emergency._id });
    });
  });

  describe("Multi-Tenant Isolation & Zero Trust Security", () => {
    it("should reject heartbeat when device token attempts cross-tenant report with 403 TENANT_MISMATCH", async () => {
      const crossTenantResp = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${deviceToken}` },
        payload: {
          organizationId: otherOrg._id.toString(),
          currentContentVersion: 1
        }
      });

      expect(crossTenantResp.statusCode).toBe(403);
      const body = JSON.parse(crossTenantResp.payload);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("should reject heartbeat without authentication with 401 UNAUTHORIZED", async () => {
      const unauthResp = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        payload: { currentContentVersion: 1 }
      });

      expect(unauthResp.statusCode).toBe(401);
    });
  });
});
