import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import config from "../config/index.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskDeviceModel,
  KioskJourneyModel,
  KioskDeviceAssignmentModel
} from "../modules/kiosk/index.js";

function createSignedToken(payload: any, secret = config.jwt.secret): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encode = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const data = `${encode(header)}.${encode(payload)}`;
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

describe("K-SEC-001: Zero Trust Device Authorization & Tenant Assertions", () => {
  let app: any;
  let orgA: any;
  let orgB: any;
  let deviceA: any;
  let deviceB: any;
  let deviceAToken: string;
  let deviceBToken: string;
  let expiredToken: string;
  let forgedDeviceToken: string;
  let employeeToken: string;
  let journeyOrgA: any;
  let journeyOrgB: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test organizations, devices, and journeys
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["zero-trust-org-a", "zero-trust-org-b"] } }),
      KioskDeviceModel.deleteMany({ deviceId: { $in: ["device-zt-001", "device-zt-002", "device-zt-revoked"] } }),
      KioskJourneyModel.deleteMany({ journeyCode: { $in: ["KJ-ZT-001", "KJ-ZT-002"] } }),
    ]);

    // Create Tenant Organizations
    [orgA, orgB] = await Promise.all([
      Organization.create({
        name: "Zero Trust Org A",
        slug: "zero-trust-org-a",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      }),
      Organization.create({
        name: "Zero Trust Org B",
        slug: "zero-trust-org-b",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      })
    ]);

    const defaultSettings = {
      autoPlay: false,
      loopForever: false,
      idleTimeoutSeconds: 60,
      autoReturnHome: true,
      hideNavigation: false,
      disableExit: true,
      security: { protectionType: "none" }
    };

    const dummySteps = [
      {
        id: "step-1",
        title: "Step 1",
        type: "content",
        blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Hello" } }],
        order: 0,
        interaction: { type: "tap_to_continue" }
      }
    ];

    // Create Test Journeys for both organizations
    journeyOrgA = await KioskJourneyModel.create({
      organizationId: orgA._id,
      title: "Org A Journey",
      journeyCode: "KJ-ZT-001",
      publishing: { status: "published", version: 1, publishedAt: new Date() },
      steps: dummySteps,
      settings: defaultSettings,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });

    journeyOrgB = await KioskJourneyModel.create({
      organizationId: orgB._id,
      title: "Org B Journey",
      journeyCode: "KJ-ZT-002",
      publishing: { status: "published", version: 1, publishedAt: new Date() },
      steps: dummySteps,
      settings: defaultSettings,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });

    // Generate cryptographic tokens for devices
    deviceAToken = app.jwt.sign(
      {
        deviceId: "device-zt-001",
        hardwareGuid: "device-zt-001",
        organizationId: orgA._id.toString(),
        role: "kiosk_device",
        jti: crypto.randomUUID()
      },
      { expiresIn: "90d" }
    );

    deviceBToken = app.jwt.sign(
      {
        deviceId: "device-zt-002",
        hardwareGuid: "device-zt-002",
        organizationId: orgB._id.toString(),
        role: "kiosk_device",
        jti: crypto.randomUUID()
      },
      { expiresIn: "90d" }
    );

    expiredToken = createSignedToken(
      {
        deviceId: "device-zt-001",
        organizationId: orgA._id.toString(),
        role: "kiosk_device",
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000) - 300,
        exp: Math.floor(Date.now() / 1000) - 60
      },
      config.jwt.secret
    );

    employeeToken = app.jwt.sign(
      {
        userId: new mongoose.Types.ObjectId().toString(),
        email: "employee@zerotrust.test",
        organizationId: orgA._id.toString(),
        role: "employee"
      },
      { expiresIn: "1h" }
    );

    forgedDeviceToken = createSignedToken(
      {
        deviceId: "device-zt-001",
        organizationId: orgA._id.toString(),
        role: "kiosk_device",
        jti: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      "attacker-untrusted-arbitrary-secret-key-12345"
    );

    // Register active devices in database with hash
    const tokenRefA = crypto.createHash("sha256").update(deviceAToken).digest("hex");
    const tokenRefB = crypto.createHash("sha256").update(deviceBToken).digest("hex");

    deviceA = await KioskDeviceModel.create({
      organizationId: orgA._id,
      deviceId: "device-zt-001",
      hardwareGuid: "device-zt-001",
      name: "Zero Trust Device A",
      location: "Building A",
      status: "online",
      paired: true,
      tokenRef: tokenRefA,
      tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isDeleted: false,
      lastSeen: new Date(),
      lastHeartbeatAt: new Date()
    });

    deviceB = await KioskDeviceModel.create({
      organizationId: orgB._id,
      deviceId: "device-zt-002",
      hardwareGuid: "device-zt-002",
      name: "Zero Trust Device B",
      location: "Building B",
      status: "online",
      paired: true,
      tokenRef: tokenRefB,
      tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      isDeleted: false,
      lastSeen: new Date(),
      lastHeartbeatAt: new Date()
    });

    // Create assignment for Device A
    await KioskDeviceAssignmentModel.create({
      organizationId: orgA._id,
      targetType: "device",
      targetId: deviceA._id,
      journeyId: journeyOrgA._id,
      priority: 0,
      isActive: true,
      assignedBy: new mongoose.Types.ObjectId()
    });
  });

  afterAll(async () => {
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["zero-trust-org-a", "zero-trust-org-b"] } }),
      KioskDeviceModel.deleteMany({ deviceId: { $in: ["device-zt-001", "device-zt-002", "device-zt-revoked"] } }),
      KioskJourneyModel.deleteMany({ journeyCode: { $in: ["KJ-ZT-001", "KJ-ZT-002"] } }),
      KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } })
    ]);
    await disconnectDatabase(app.log);
  });

  // =========================================================================
  // Acceptance Criterion 1: Forged Token Rejection (401 UNAUTHORIZED)
  // =========================================================================
  describe("Acceptance Criterion 1: Cryptographic Bearer Token Validation & Forgery Rejection", () => {
    it("Given a forged JWT token signed with an arbitrary secret, When submitted to /devices/heartbeat, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${forgedDeviceToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 95 }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code || body.error).toBe("UNAUTHORIZED");
    });

    it("Given a forged JWT token signed with an arbitrary secret, When submitted to /analytics/sync, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${forgedDeviceToken}`,
          "content-type": "application/json"
        },
        payload: {
          events: [
            { journeyId: journeyOrgA._id.toString(), stepId: "step-1", eventType: "STEP_VIEWED" }
          ]
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code || body.error).toBe("UNAUTHORIZED");
    });

    it("Given a forged JWT token signed with an arbitrary secret, When submitted to /devices/manifest, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/manifest",
        headers: {
          authorization: `Bearer ${forgedDeviceToken}`
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code || body.error).toBe("UNAUTHORIZED");
    });

    it("Given a forged JWT token signed with an arbitrary secret, When submitted to /devices/:deviceId/manifest, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: {
          authorization: `Bearer ${forgedDeviceToken}`
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code || body.error).toBe("UNAUTHORIZED");
    });

    it("Given a forged JWT token signed with an arbitrary secret, When submitted to /devices/commands, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/commands",
        headers: {
          authorization: `Bearer ${forgedDeviceToken}`
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code || body.error).toBe("UNAUTHORIZED");
    });

    it("Given a completely malformed token string, When submitted to a device endpoint, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: "Bearer completely-corrupted-and-invalid-token",
          "content-type": "application/json"
        },
        payload: { batteryLevel: 80 }
      });

      expect(res.statusCode).toBe(401);
    });

    it("Given a missing Authorization header, When submitted to a device endpoint, Then rejected with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { "content-type": "application/json" },
        payload: { batteryLevel: 80 }
      });

      expect(res.statusCode).toBe(401);
    });

    it("Given a standard employee token (non-device role), When submitted to /devices/heartbeat, Then rejected with 403 FORBIDDEN", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${employeeToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 90 }
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // Acceptance Criterion 2: Cross-Tenant Isolation (403 TENANT_MISMATCH)
  // =========================================================================
  describe("Acceptance Criterion 2: Multi-Tenant Boundary Assertions (403 TENANT_MISMATCH)", () => {
    it("Given a valid device token for Organization A, When attempting to fetch journey manifest for Device B (Org B), Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceB.deviceId}/manifest`,
        headers: {
          authorization: `Bearer ${deviceAToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to query manifest with explicit organizationId for Org B, Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/manifest?organizationId=${orgB._id}`,
        headers: {
          authorization: `Bearer ${deviceAToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to query manifest with x-organization-id header for Org B, Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/manifest",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "x-organization-id": orgB._id.toString()
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to sync analytics with body.organizationId for Org B, Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: {
          organizationId: orgB._id.toString(),
          events: [
            { journeyId: journeyOrgA._id.toString(), stepId: "step-1", eventType: "STEP_VIEWED" }
          ]
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to sync analytics with events for Org B journey, Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: {
          events: [
            { journeyId: journeyOrgB._id.toString(), stepId: "step-1", eventType: "STEP_VIEWED" }
          ]
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to send heartbeat for Org B, Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: {
          organizationId: orgB._id.toString(),
          batteryLevel: 90
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });

    it("Given a valid device token for Organization A, When attempting to get commands for Device B (Org B), Then rejected with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceB.deviceId}/commands`,
        headers: {
          authorization: `Bearer ${deviceAToken}`
        }
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TENANT_MISMATCH");
    });
  });

  // =========================================================================
  // Expired & Revoked Hardware Credentials Rejection
  // =========================================================================
  describe("Expired & Revoked Hardware Security Checks", () => {
    it("Given an expired device token, When submitted to /devices/heartbeat, Then rejected with 401 TOKEN_EXPIRED", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${expiredToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 75 }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TOKEN_EXPIRED");
    });

    it("Given a revoked / decommissioned device, When submitted with otherwise valid signature, Then rejected with 401 DEVICE_REVOKED", async () => {
      // Create a decommissioned device and sign a valid token for it
      const revokedToken = app.jwt.sign(
        {
          deviceId: "device-zt-revoked",
          organizationId: orgA._id.toString(),
          role: "kiosk_device",
          jti: crypto.randomUUID()
        },
        { expiresIn: "90d" }
      );
      const revokedRef = crypto.createHash("sha256").update(revokedToken).digest("hex");

      await KioskDeviceModel.create({
        organizationId: orgA._id,
        deviceId: "device-zt-revoked",
        name: "Revoked Terminal",
        location: "Warehouse",
        status: "decommissioned",
        paired: false,
        tokenRef: revokedRef,
        isDeleted: false
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${revokedToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 50 }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("DEVICE_REVOKED");
    });

    it("Given a device whose token has been rotated (tokenRef mismatch), When previous token is presented, Then rejected with 401 DEVICE_REVOKED", async () => {
      // Simulate token rotation by changing tokenRef in DB
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { tokenRef: "invalidated-old-rotated-hash" } }
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 80 }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("DEVICE_REVOKED");

      // Restore original tokenRef
      const originalRef = crypto.createHash("sha256").update(deviceAToken).digest("hex");
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { tokenRef: originalRef } }
      );
    });
  });

  // =========================================================================
  // Positive Path: Authorized Device Requests Succeeded
  // =========================================================================
  describe("Zero Trust Verified Device Operations", () => {
    it("Given a valid device token for Organization A, When sending heartbeat ping, Then succeeds with 200 OK", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: { batteryLevel: 98, isCharging: true }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
    });

    it("Given a valid device token for Organization A, When fetching own manifest, Then succeeds with 200 OK", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: {
          authorization: `Bearer ${deviceAToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.deviceId).toBe(deviceA.deviceId);
      expect(body.data.journeys).toHaveLength(1);
    });

    it("Given a valid device token for Organization A, When syncing analytics for own organization, Then succeeds with 200 OK", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/analytics/sync",
        headers: {
          authorization: `Bearer ${deviceAToken}`,
          "content-type": "application/json"
        },
        payload: {
          events: [
            {
              journeyId: journeyOrgA._id.toString(),
              stepId: "step-1",
              eventType: "STEP_VIEWED",
              durationSeconds: 12
            }
          ]
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.syncedCount).toBe(1);
    });

    it("Given a valid device token for Organization A, When fetching device commands, Then succeeds with 200 OK", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/commands",
        headers: {
          authorization: `Bearer ${deviceAToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.commands).toEqual([]);
    });
  });
});
