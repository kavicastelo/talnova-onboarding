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

describe("K-DEV-007: Remote Operational Commands Dispatch & Execution Suite", () => {
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
  const hardwareGuidA = `HW-REMOTE-CMD-A-${ts}`;
  const hardwareGuidB = `HW-REMOTE-CMD-B-${ts}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization A
    testOrg = await Organization.create({
      name: `Remote Cmd Plant A ${ts}`,
      slug: `cmd-plant-a-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // 2. Create Organization B
    otherOrg = await Organization.create({
      name: `Remote Cmd Plant B ${ts}`,
      slug: `cmd-plant-b-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // 3. Create Admin User for Organization A
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `cmd-admin-${ts}@talnova.test`,
        passwordHash: "dummy-hash-for-testing"
      },
      profile: {
        firstName: "Remote",
        lastName: "Commander",
        fullName: "Remote Commander"
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

    // 4. Create Kiosk Device A in Organization A
    deviceToken = app.jwt.sign({
      deviceId: hardwareGuidA,
      organizationId: testOrg._id.toString(),
      role: "kiosk_device"
    });
    const tokenHashA = crypto.createHash("sha256").update(deviceToken).digest("hex");

    deviceRecord = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: hardwareGuidA,
      hardwareGuid: hardwareGuidA,
      name: "Gate 1 Turnstile Kiosk",
      location: "Building 1 - North Entrance",
      deviceType: "wall_mount",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: tokenHashA,
      currentContentVersion: 1,
      telemetry: {
        batteryLevel: 92,
        isCharging: true,
        networkLatencyMs: 25,
        appVersion: "1.0.0"
      },
      pendingCommands: [],
      lastSeen: new Date(),
      isDeleted: false
    });

    // 5. Create Kiosk Device B in Organization B (Tenant Isolation testing)
    otherDeviceToken = app.jwt.sign({
      deviceId: hardwareGuidB,
      organizationId: otherOrg._id.toString(),
      role: "kiosk_device"
    });
    const tokenHashB = crypto.createHash("sha256").update(otherDeviceToken).digest("hex");

    otherDeviceRecord = await KioskDeviceModel.create({
      organizationId: otherOrg._id,
      deviceId: hardwareGuidB,
      hardwareGuid: hardwareGuidB,
      name: "Plant B Loading Dock",
      location: "Warehouse 2 - Gate B",
      deviceType: "floor_standing",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: tokenHashB,
      currentContentVersion: 1,
      telemetry: {},
      pendingCommands: [],
      lastSeen: new Date(),
      isDeleted: false
    });
  });

  afterAll(async () => {
    await KioskDeviceModel.deleteMany({
      deviceId: { $in: [hardwareGuidA, hardwareGuidB] }
    });
    await KioskEmergencyModel.deleteMany({
      organizationId: { $in: [testOrg._id, otherOrg._id] }
    });
    await User.deleteMany({
      organizationId: { $in: [testOrg._id, otherOrg._id] }
    });
    await Organization.deleteMany({
      _id: { $in: [testOrg._id, otherOrg._id] }
    });
    await app.close();
  });

  describe("1. Command Queueing (POST /api/v1/kiosk/devices/:id/commands)", () => {
    it("should allow an admin to queue RELOAD_MANIFEST for a device using MongoDB ObjectId", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          type: "RELOAD_MANIFEST",
          payload: { targetVersion: 3, reason: "New OSHA compliance flow published" }
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.command).toBeDefined();
      expect(body.command.type).toBe("RELOAD_MANIFEST");
      expect(body.command.status).toBe("pending");
      expect(body.command.id).toMatch(/^cmd-/);

      // Verify in DB
      const inDb = await KioskDeviceModel.findById(deviceRecord._id);
      expect(inDb?.pendingCommands?.length).toBe(1);
      expect(inDb?.pendingCommands?.[0].type).toBe("RELOAD_MANIFEST");
      expect(inDb?.pendingCommands?.[0].status).toBe("pending");
    });

    it("should allow an admin to queue ENTER_MAINTENANCE using Hardware GUID", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${hardwareGuidA}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          command: "ENTER_MAINTENANCE",
          payload: { scheduledDurationMinutes: 45, technicianId: "TECH-901" }
        }
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.command.type).toBe("ENTER_MAINTENANCE");
      expect(body.command.payload.scheduledDurationMinutes).toBe(45);

      // Verify device status transitioned to 'maintenance'
      const inDb = await KioskDeviceModel.findById(deviceRecord._id);
      expect(inDb?.status).toBe("maintenance");
    });

    it("should allow queuing EXIT_MAINTENANCE and transition device status back to online", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${hardwareGuidA}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          type: "EXIT_MAINTENANCE",
          payload: { reason: "Maintenance complete, returning to service" }
        }
      });

      expect(response.statusCode).toBe(201);
      const inDb = await KioskDeviceModel.findById(deviceRecord._id);
      expect(inDb?.status).toBe("online");
    });

    it("should allow queuing CLEAR_CACHE and FORCE_RESET commands", async () => {
      const cacheResp = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "CLEAR_CACHE", payload: { purgeIndexedDb: true } }
      });
      expect(cacheResp.statusCode).toBe(201);

      const resetResp = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "FORCE_RESET", payload: { reloadDelayMs: 500 } }
      });
      expect(resetResp.statusCode).toBe(201);
    });

    it("should prevent cross-tenant command queueing (Tenant Isolation)", async () => {
      // Admin from Org A attempts to send command to Device B in Org B
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${otherDeviceRecord._id}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          type: "RELOAD_MANIFEST"
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.message).toContain("Device not found");
    });

    it("should reject command queueing without authentication", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        payload: {
          type: "RELOAD_MANIFEST"
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject commands with missing type and command fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          payload: { some: "data" }
        }
      });

      expect([400, 422]).toContain(response.statusCode);
    });
  });

  describe("2. Heartbeat Delivery & At-Most-Once Dispatch (POST /devices/heartbeat)", () => {
    it("should deliver all queued pending commands to the terminal on its next heartbeat ping", async () => {
      // Device A currently has pending commands in DB
      const heartbeatResponse = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 1,
          networkLatencyMs: 18
        }
      });

      expect(heartbeatResponse.statusCode).toBe(200);
      const body = JSON.parse(heartbeatResponse.payload);

      expect(body.success).toBe(true);
      expect(Array.isArray(body.commands)).toBe(true);
      expect(body.commands.length).toBeGreaterThanOrEqual(4);

      // Verify specific command types are present in payload
      const commandTypes = body.commands.map((c: any) => c.type);
      expect(commandTypes).toContain("RELOAD_MANIFEST");
      expect(commandTypes).toContain("ENTER_MAINTENANCE");
      expect(commandTypes).toContain("EXIT_MAINTENANCE");
      expect(commandTypes).toContain("CLEAR_CACHE");
      expect(commandTypes).toContain("FORCE_RESET");

      // Verify that commands in database are now marked as 'dispatched'
      const inDbAfter = await KioskDeviceModel.findById(deviceRecord._id);
      const pendingRemaining = inDbAfter?.pendingCommands?.filter((c: any) => c.status === "pending");
      expect(pendingRemaining?.length).toBe(0);

      const dispatched = inDbAfter?.pendingCommands?.filter((c: any) => c.status === "dispatched");
      expect(dispatched?.length).toBeGreaterThanOrEqual(4);
      expect(dispatched?.[0].dispatchedAt).toBeDefined();
    });

    it("should NOT redeliver commands on subsequent heartbeat (At-Most-Once delivery)", async () => {
      const secondHeartbeat = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceToken}`
        },
        payload: {
          currentContentVersion: 2
        }
      });

      expect(secondHeartbeat.statusCode).toBe(200);
      const body = JSON.parse(secondHeartbeat.payload);
      expect(body.commands.length).toBe(0);
    });

    it("should prioritize emergency_override command during active safety emergency", async () => {
      // 1. Create an active emergency for Organization A
      const emergency = await KioskEmergencyModel.create({
        organizationId: testOrg._id,
        type: "fire",
        severity: "critical",
        title: "Factory Gate Evacuation",
        message: "Severe fire alarm triggered in sector 4. Evacuate immediately.",
        evacuationRoute: "Exit through North Gate",
        isActive: true,
        triggeredAt: new Date(),
        triggeredBy: adminUser._id
      });

      // 2. Queue a normal command
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "RELOAD_MANIFEST" }
      });

      // 3. Heartbeat from Device A
      const heartbeat = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${deviceToken}` },
        payload: { currentContentVersion: 2 }
      });

      expect(heartbeat.statusCode).toBe(200);
      const body = JSON.parse(heartbeat.payload);

      const emergencyCmd = body.commands.find((c: any) => c.type === "emergency_override");
      expect(emergencyCmd).toBeDefined();
      expect(emergencyCmd.payload.title).toBe("Factory Gate Evacuation");

      const reloadCmd = body.commands.find((c: any) => c.type === "RELOAD_MANIFEST");
      expect(reloadCmd).toBeDefined();

      // Clean up emergency
      await KioskEmergencyModel.deleteMany({ _id: emergency._id });
    });
  });

  describe("3. GET /api/v1/kiosk/devices/commands Direct Retrieval", () => {
    it("should allow terminal to fetch queued commands directly", async () => {
      // Queue a new command
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceRecord._id}/commands`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { type: "CLEAR_CACHE" }
      });

      const getCommandsResp = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/commands",
        headers: {
          authorization: `Bearer ${deviceToken}`
        }
      });

      expect(getCommandsResp.statusCode).toBe(200);
      const body = JSON.parse(getCommandsResp.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.commands)).toBe(true);
      const hasClearCache = body.commands.some((c: any) => c.type === "CLEAR_CACHE");
      expect(hasClearCache).toBe(true);
    });
  });
});
