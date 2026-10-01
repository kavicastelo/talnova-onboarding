import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import config from "../config/index.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskDeviceModel,
  KioskEmergencyModel,
} from "../modules/kiosk/index.js";

function createSignedToken(payload: any, secret = config.jwt.secret): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

describe("K-SEC-004: Emergency Kiosk Mode Override & Broadcast Propagation", () => {
  let app: any;
  let orgA: any;
  let orgB: any;
  let deviceA: any;
  let deviceAToken: string;
  let adminOrgAToken: string;
  let adminOrgBToken: string;
  let employeeOrgAToken: string;
  const webhookSecret = process.env.EMERGENCY_WEBHOOK_KEY || "talnova_safety_webhook_secret";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test data
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["emergency-org-a", "emergency-org-b"] } }),
      KioskDeviceModel.deleteMany({ deviceId: "kiosk-dev-emergency-001" }),
      KioskEmergencyModel.deleteMany({}),
    ]);

    // Create Tenant Organizations
    [orgA, orgB] = await Promise.all([
      Organization.create({
        name: "Emergency Plant Org A",
        slug: "emergency-org-a",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      }),
      Organization.create({
        name: "Emergency Plant Org B",
        slug: "emergency-org-b",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false,
      }),
    ]);

    const adminUserAId = new mongoose.Types.ObjectId();
    const adminUserBId = new mongoose.Types.ObjectId();
    const employeeUserId = new mongoose.Types.ObjectId();

    // Create Tokens
    adminOrgAToken = createSignedToken({
      userId: adminUserAId.toString(),
      organizationId: orgA._id.toString(),
      role: "admin",
      permissions: ["kiosk:admin"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    adminOrgBToken = createSignedToken({
      userId: adminUserBId.toString(),
      organizationId: orgB._id.toString(),
      role: "admin",
      permissions: ["kiosk:admin"],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    employeeOrgAToken = createSignedToken({
      userId: employeeUserId.toString(),
      organizationId: orgA._id.toString(),
      role: "employee",
      permissions: [],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    deviceAToken = app.jwt.sign(
      {
        deviceId: "kiosk-dev-emergency-001",
        hardwareGuid: "kiosk-dev-emergency-001",
        organizationId: orgA._id.toString(),
        role: "kiosk_device",
        jti: crypto.randomUUID(),
      },
      { expiresIn: "90d" }
    );

    const tokenRefA = crypto.createHash("sha256").update(deviceAToken).digest("hex");

    // Create Kiosk Device in Org A
    deviceA = await KioskDeviceModel.create({
      deviceId: "kiosk-dev-emergency-001",
      hardwareGuid: "kiosk-dev-emergency-001",
      name: "Plant Floor North Terminal",
      location: "Building 4, Sector 7",
      organizationId: orgA._id,
      status: "online",
      paired: true,
      tokenRef: tokenRefA,
      tokenExpiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
      pairedAt: new Date(),
      lastSeen: new Date(),
      hardwareFingerprint: "hw-fp-emergency-001",
      credentialVersion: 1,
    });
  });

  afterAll(async () => {
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["emergency-org-a", "emergency-org-b"] } }),
      KioskDeviceModel.deleteMany({ deviceId: "kiosk-dev-emergency-001" }),
      KioskEmergencyModel.deleteMany({}),
    ]);
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Emergency Broadcast Authorization & Validation", () => {
    it("should reject unauthenticated emergency broadcast attempts with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/broadcast",
        payload: {
          organizationId: orgA._id.toString(),
          type: "fire",
          severity: "evacuate",
          title: "Fire Alarm in Sector 3",
          message: "Active fire reported in battery charging station. Evacuate immediately.",
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject non-admin / non-safety employee broadcast attempts with 403", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/broadcast",
        headers: {
          authorization: `Bearer ${employeeOrgAToken}`,
        },
        payload: {
          organizationId: orgA._id.toString(),
          type: "fire",
          severity: "evacuate",
          title: "Unauthorized Broadcast Test",
          message: "This should be blocked.",
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("should block cross-tenant emergency broadcast with 403 TENANT_MISMATCH", async () => {
      // Admin of Org B attempting to trigger emergency on Org A
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/broadcast",
        headers: {
          authorization: `Bearer ${adminOrgBToken}`,
        },
        payload: {
          organizationId: orgA._id.toString(),
          type: "toxic_spill",
          severity: "critical",
          title: "Cross Tenant Attack",
          message: "Attempt to trigger alarm in rival tenant",
        },
      });

      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.body);
      expect(data.code).toBe("TENANT_MISMATCH");
    });
  });

  describe("2. Admin Emergency Broadcast", () => {
    it("should allow an authenticated admin to broadcast an emergency override", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/broadcast",
        headers: {
          authorization: `Bearer ${adminOrgAToken}`,
        },
        payload: {
          type: "fire",
          severity: "evacuate",
          title: "CRITICAL FIRE ALARM - LEVEL 2",
          message: "Fire suppression system activated in Workshop 4. Proceed to muster point.",
          primaryExit: "East Stairwell Ground Floor Exit",
          secondaryExit: "West Service Emergency Door",
          assemblyZone: "Muster Station Alpha (North Parking Courtyard)",
          soundSiren: true,
          emergencyContacts: [
            { name: "Plant Emergency Control Room", phone: "+1 (555) 911-0420", role: "Dispatcher" },
            { name: "Safety Marshal On Duty", phone: "+1 (555) 911-0112", role: "Floor Marshal" },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.data.isActive).toBe(true);
      expect(data.data.title).toBe("CRITICAL FIRE ALARM - LEVEL 2");
      expect(data.data.primaryExit).toBe("East Stairwell Ground Floor Exit");
      expect(data.data.emergencyContacts).toHaveLength(2);

      // Verify active emergency in database
      const saved = await KioskEmergencyModel.findOne({
        organizationId: orgA._id,
        isActive: true,
      });
      expect(saved).toBeTruthy();
      expect(saved?.title).toBe("CRITICAL FIRE ALARM - LEVEL 2");
    });
  });

  describe("3. Emergency Status & Dual-Channel Propagation", () => {
    it("should return the active emergency status for the targeted tenant", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/emergency/status?organizationId=${orgA._id}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.active).toBe(true);
      expect(data.emergency.title).toBe("CRITICAL FIRE ALARM - LEVEL 2");
      expect(data.emergency.assemblyZone).toBe("Muster Station Alpha (North Parking Courtyard)");
    });

    it("should return active: false for other tenants not affected by the emergency", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/emergency/status?organizationId=${orgB._id}`,
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.active).toBe(false);
      expect(data.emergency).toBeNull();
    });

    it("should propagate activeEmergency and emergency_override command in device heartbeat", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
        },
        payload: {
          status: "online",
          batteryLevel: 98,
          isCharging: true,
          networkType: "ethernet",
          storageFreeMB: 4096,
          screenResolution: "1920x1080",
          appVersion: "2.1.0",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.data.activeEmergency).toBeTruthy();
      expect(data.data.activeEmergency.title).toBe("CRITICAL FIRE ALARM - LEVEL 2");

      // Verify commands array includes emergency_override
      const commands = data.data.commands || [];
      const emergencyCmd = commands.find((cmd: any) => cmd.type === "emergency_override");
      expect(emergencyCmd).toBeTruthy();
      expect(emergencyCmd.payload.type).toBe("fire");
    });

    it("should return emergency_override command when querying /devices/commands", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/commands",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      const commands = data.commands || data.data || [];
      const overrideCmd = commands.find((c: any) => c.type === "emergency_override");
      expect(overrideCmd).toBeTruthy();
      expect(overrideCmd.payload.title).toBe("CRITICAL FIRE ALARM - LEVEL 2");
    });
  });

  describe("4. Safety Webhook Integration", () => {
    it("should allow external fire alarm / safety webhook to broadcast an emergency", async () => {
      // Clear previous emergency first
      await KioskEmergencyModel.updateMany({ organizationId: orgA._id }, { isActive: false });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/broadcast",
        headers: {
          "x-emergency-webhook-key": webhookSecret,
        },
        payload: {
          organizationId: orgA._id.toString(),
          type: "toxic_spill",
          severity: "critical",
          title: "AUTOMATED CHEMICAL SENSOR DETECTED AMMONIA LEAK",
          message: "Atmospheric monitor #402 detected high NH3 levels in containment zone.",
          soundSiren: true,
          primaryExit: "South Windward Fire Door",
          assemblyZone: "Upwind Muster Station B",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);
      expect(data.data.type).toBe("toxic_spill");
      expect(data.data.triggeredBy).toBe("safety_webhook");
    });
  });

  describe("5. Clearing Emergency Broadcast", () => {
    it("should allow an admin to clear an active emergency", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/emergency/clear",
        headers: {
          authorization: `Bearer ${adminOrgAToken}`,
        },
        payload: {
          reason: "All clear confirmed by Plant Safety Marshal. Ammonia dissipated.",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(true);

      // Verify emergency is no longer active in database
      const activeEmergency = await KioskEmergencyModel.findOne({
        organizationId: orgA._id,
        isActive: true,
      });
      expect(activeEmergency).toBeNull();

      // Check emergency status returns active: false
      const statusRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/emergency/status?organizationId=${orgA._id}`,
      });
      const statusData = JSON.parse(statusRes.body);
      expect(statusData.active).toBe(false);
      expect(statusData.emergency).toBeNull();
    });

    it("should no longer include activeEmergency in subsequent device heartbeats", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
        },
        payload: {
          status: "online",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.data.activeEmergency).toBeUndefined();
    });
  });
});
