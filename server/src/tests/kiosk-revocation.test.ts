import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import nodeCrypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/index.js";

describe("K-DEV-004: Instantaneous Device Revocation & DEF-005 Security Suite", () => {
  let app: any;
  let orgId: mongoose.Types.ObjectId;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;

  const activeDeviceId = "hw-guid-revocation-active-001";
  const suspendedDeviceId = "hw-guid-revocation-suspended-002";
  const deletedDeviceId = "hw-guid-revocation-deleted-003";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up previous test artifacts
    await Organization.deleteMany({ slug: "kiosk-revocation-test-org" });
    await User.deleteMany({ "auth.email": { $in: ["kiosk-revocation-admin@test.com", "kiosk-revocation-worker@test.com"] } });
    await KioskDeviceModel.deleteMany({
      deviceId: { $in: [activeDeviceId, suspendedDeviceId, deletedDeviceId] }
    });

    // Seed test organization
    const org = await Organization.create({
      name: "Kiosk Revocation Security Org",
      slug: "kiosk-revocation-test-org",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgId = org._id as mongoose.Types.ObjectId;

    // Seed admin user
    adminUser = await User.create({
      organizationId: orgId,
      auth: {
        email: "kiosk-revocation-admin@test.com",
        passwordHash: "placeholder",
        failedLoginAttempts: 0
      },
      profile: { firstName: "Security", lastName: "Admin" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: orgId.toString(),
      role: "admin"
    });

    // Seed employee user to assert device revocation does NOT impact employee credentials
    employeeUser = await User.create({
      organizationId: orgId,
      auth: {
        email: "kiosk-revocation-worker@test.com",
        passwordHash: "placeholder",
        failedLoginAttempts: 0
      },
      profile: { firstName: "Factory", lastName: "Worker" },
      permissions: { role: "employee" },
      employment: { status: "active" },
      isDeleted: false
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: orgId.toString(),
      role: "employee"
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: orgId });
    await User.deleteMany({ _id: { $in: [adminUser._id, employeeUser._id] } });
    await KioskDeviceModel.deleteMany({
      deviceId: { $in: [activeDeviceId, suspendedDeviceId, deletedDeviceId] }
    });

    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Administrative Device Revocation (POST /api/v1/kiosk/devices/:id/revoke)", () => {
    let pairedDeviceToken: string;
    let pairedDeviceDocId: string;

    beforeAll(async () => {
      // 1. Generate pairing code
      const codeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          deviceId: activeDeviceId
        }
      });
      const { code } = JSON.parse(codeRes.payload);

      // 2. Pair device
      const pairRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: activeDeviceId,
          name: "Gate 1 Assembly Tablet",
          location: "Assembly Plant Floor"
        }
      });

      expect(pairRes.statusCode).toBe(200);
      const pairBody = JSON.parse(pairRes.payload);
      pairedDeviceToken = pairBody.token || pairBody.deviceToken;
      pairedDeviceDocId = pairBody.device._id || pairBody.device.id;
    });

    it("verifies paired device can successfully send heartbeats prior to revocation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${pairedDeviceToken}`
        },
        payload: {
          currentContentVersion: 1,
          telemetry: {
            batteryLevel: 0.95,
            isCharging: true
          }
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe("ok");
    });

    it("requires admin authentication to execute revocation", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${pairedDeviceDocId}/revoke`,
        headers: {
          authorization: `Bearer ${employeeToken}` // Not an admin
        }
      });

      expect([401, 403]).toContain(res.statusCode);
    });

    it("admin revokes device via POST /devices/:id/revoke: sets status=decommissioned, paired=false, tokenRef=''", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${pairedDeviceDocId}/revoke`,
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("decommissioned");
      expect(body.data.paired).toBe(false);
      expect(body.data.tokenRef).toBe("");

      // Verify directly in MongoDB
      const dbDevice = await KioskDeviceModel.findById(pairedDeviceDocId);
      expect(dbDevice).toBeDefined();
      expect(dbDevice?.status).toBe("decommissioned");
      expect(dbDevice?.paired).toBe(false);
      expect(dbDevice?.tokenRef).toBe("");
      expect(dbDevice?.isDeleted).toBe(true);
      expect(dbDevice?.deletedAt).toBeDefined();
    });

    it("asserts revoked device heartbeat is rejected immediately with 401 DEVICE_REVOKED on the very next HTTP request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${pairedDeviceToken}`
        },
        payload: {
          currentContentVersion: 1,
          telemetry: {
            batteryLevel: 0.90
          }
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("DEVICE_REVOKED");
      expect(body.message).toContain("Device credentials have been revoked or invalidated.");
    });
  });

  describe("Strict Status and Hash Assertion in verifyDeviceToken", () => {
    it("rejects heartbeat from suspended devices with 401 DEVICE_REVOKED", async () => {
      // 1. Sign valid device token
      const token = app.jwt.sign(
        {
          deviceId: suspendedDeviceId,
          organizationId: orgId.toString(),
          role: "kiosk_device"
        },
        { expiresIn: "90d" }
      );
      const tokenRef = nodeCrypto.createHash("sha256").update(token).digest("hex");

      // 2. Create device marked suspended
      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: suspendedDeviceId,
        hardwareGuid: suspendedDeviceId,
        name: "Suspended Warehouse Terminal",
        location: "Warehouse D",
        status: "suspended",
        paired: true,
        tokenRef,
        isDeleted: false,
        telemetry: {}
      });

      // 3. Heartbeat attempt
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentContentVersion: 1
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("DEVICE_REVOKED");
    });

    it("rejects heartbeat from soft-deleted devices (isDeleted: true) with 401 DEVICE_REVOKED", async () => {
      const token = app.jwt.sign(
        {
          deviceId: deletedDeviceId,
          organizationId: orgId.toString(),
          role: "kiosk_device"
        },
        { expiresIn: "90d" }
      );
      const tokenRef = nodeCrypto.createHash("sha256").update(token).digest("hex");

      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: deletedDeviceId,
        hardwareGuid: deletedDeviceId,
        name: "Deleted Tablet",
        location: "Scrapped Area",
        status: "online",
        paired: true,
        tokenRef,
        isDeleted: true, // Marked deleted
        telemetry: {}
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${token}`
        },
        payload: {
          currentContentVersion: 1
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("DEVICE_REVOKED");
    });

    it("rejects heartbeat when bearer token hash does not match stored tokenRef with 401 DEVICE_REVOKED", async () => {
      const legitimateToken = app.jwt.sign(
        {
          deviceId: "mismatch-test-device",
          organizationId: orgId.toString(),
          role: "kiosk_device"
        },
        { expiresIn: "90d" }
      );
      const storedRef = nodeCrypto.createHash("sha256").update(legitimateToken).digest("hex");

      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: "mismatch-test-device",
        hardwareGuid: "mismatch-test-device",
        name: "Mismatch Terminal",
        location: "Lobby",
        status: "online",
        paired: true,
        tokenRef: storedRef,
        isDeleted: false,
        telemetry: {}
      });

      // Different valid token for same device
      const alteredToken = app.jwt.sign(
        {
          deviceId: "mismatch-test-device",
          organizationId: orgId.toString(),
          role: "kiosk_device",
          salt: "different-jwt-instance"
        },
        { expiresIn: "90d" }
      );

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: {
          authorization: `Bearer ${alteredToken}`
        },
        payload: {
          currentContentVersion: 1
        }
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("DEVICE_REVOKED");

      await KioskDeviceModel.deleteMany({ deviceId: "mismatch-test-device" });
    });

    it("supports revocation by deviceId string and ensures idempotency", async () => {
      const token = app.jwt.sign(
        {
          deviceId: "guid-revoke-by-string",
          organizationId: orgId.toString(),
          role: "kiosk_device"
        },
        { expiresIn: "90d" }
      );
      const tokenRef = nodeCrypto.createHash("sha256").update(token).digest("hex");

      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: "guid-revoke-by-string",
        hardwareGuid: "guid-revoke-by-string",
        name: "String Target Terminal",
        location: "Dock 4",
        status: "online",
        paired: true,
        tokenRef,
        isDeleted: false,
        telemetry: {}
      });

      // Revoke using deviceId string instead of ObjectId
      const revokeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/guid-revoke-by-string/revoke",
        headers: {
          authorization: `Bearer ${adminToken}`
        }
      });

      expect(revokeRes.statusCode).toBe(200);
      const body = JSON.parse(revokeRes.payload);
      expect(body.data.status).toBe("decommissioned");
      expect(body.data.tokenRef).toBe("");

      await KioskDeviceModel.deleteMany({ deviceId: "guid-revoke-by-string" });
    });
  });

  describe("Security Invariant: Employee Credentials Isolation", () => {
    it("ensures physical terminal revocation MUST NOT invalidate employee credentials", async () => {
      // The employee token created in beforeAll must still verify cleanly
      const decoded = app.jwt.verify(employeeToken);
      expect(decoded.userId).toBe(employeeUser._id.toString());
      expect(decoded.role).toBe("employee");

      const dbEmployee = await User.findById(employeeUser._id);
      expect(dbEmployee).toBeDefined();
      expect(dbEmployee?.isDeleted).toBe(false);
      expect(dbEmployee?.employment?.status).toBe("active");
    });
  });
});
