import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/index.js";

describe("K-DEV-003: Device Credential Refresh & Automatic Token Rotation Suite", () => {
  let app: any;
  let orgId: mongoose.Types.ObjectId;
  let adminUser: any;
  let adminToken: string;

  const testDeviceId = "hw-guid-refresh-suite-001";
  const suspendedDeviceId = "hw-guid-refresh-suspended-002";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test data
    await Organization.deleteMany({ slug: "kiosk-refresh-test-org" });
    await User.deleteMany({ "auth.email": "kiosk-refresh-admin@test.com" });
    await KioskDeviceModel.deleteMany({ deviceId: { $in: [testDeviceId, suspendedDeviceId] } });

    // Seed test organization
    const org = await Organization.create({
      name: "Kiosk Refresh Test Org",
      slug: "kiosk-refresh-test-org",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgId = org._id as mongoose.Types.ObjectId;

    // Seed admin user
    adminUser = await User.create({
      organizationId: orgId,
      auth: {
        email: "kiosk-refresh-admin@test.com",
        passwordHash: "placeholder",
        failedLoginAttempts: 0
      },
      profile: { firstName: "Refresh", lastName: "Admin" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: orgId.toString(),
      role: "admin"
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: orgId });
    await User.deleteMany({ _id: adminUser._id });
    await KioskDeviceModel.deleteMany({ deviceId: { $in: [testDeviceId, suspendedDeviceId] } });

    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Token Rotation & Lifecycle", () => {
    let initialToken: string;
    let initialTokenRef: string;

    it("pairs a new device and returns a token with 90-day expiry", async () => {
      // 1. Generate pairing code
      const codeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          deviceId: testDeviceId
        }
      });
      const { code } = JSON.parse(codeRes.payload);

      // 2. Pair device
      const pairRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: testDeviceId,
          name: "Rotating Kiosk Terminal",
          location: "Security Desk"
        }
      });

      expect(pairRes.statusCode).toBe(200);
      const pairBody = JSON.parse(pairRes.payload);
      expect(pairBody.deviceToken).toBeDefined();

      initialToken = pairBody.deviceToken;
      initialTokenRef = crypto.createHash("sha256").update(initialToken).digest("hex");

      // Verify token decoded claims show 90 days lifetime (7776000 seconds)
      const decoded: any = app.jwt.decode(initialToken);
      expect(decoded.deviceId).toBe(testDeviceId);
      expect(decoded.organizationId).toBe(orgId.toString());
      expect(decoded.role).toBe("kiosk_device");
      const lifetimeSeconds = decoded.exp - decoded.iat;
      expect(lifetimeSeconds).toBe(90 * 24 * 3600);

      // Verify MongoDB document
      const deviceInDb = await KioskDeviceModel.findOne({ deviceId: testDeviceId });
      expect(deviceInDb).not.toBeNull();
      expect(deviceInDb!.tokenRef).toBe(initialTokenRef);
      expect(deviceInDb!.tokenExpiresAt).toBeDefined();
    });

    it("rotates device credentials and returns a new 90-day token when requesting refresh-token", async () => {
      const refreshRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/refresh-token",
        headers: {
          authorization: `Bearer ${initialToken}`
        }
      });

      expect(refreshRes.statusCode).toBe(200);
      const refreshBody = JSON.parse(refreshRes.payload);
      expect(refreshBody.success).toBe(true);
      expect(refreshBody.deviceToken).toBeDefined();
      expect(refreshBody.deviceToken).not.toBe(initialToken);

      const rotatedToken = refreshBody.deviceToken;
      const rotatedDecoded: any = app.jwt.decode(rotatedToken);
      expect(rotatedDecoded.deviceId).toBe(testDeviceId);
      expect(rotatedDecoded.exp - rotatedDecoded.iat).toBe(90 * 24 * 3600);

      // Verify KioskDeviceModel tokenRef was updated with hash of new token
      const expectedNewTokenRef = crypto.createHash("sha256").update(rotatedToken).digest("hex");
      const updatedDevice = await KioskDeviceModel.findOne({ deviceId: testDeviceId });
      expect(updatedDevice!.tokenRef).toBe(expectedNewTokenRef);
      expect(updatedDevice!.tokenRef).not.toBe(initialTokenRef);
    });

    it("immediately invalidates the previous token upon rotation (assert 401 UNAUTHORIZED)", async () => {
      // Presenting initialToken again must now be rejected because tokenRef has changed
      const replayRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/refresh-token",
        headers: {
          authorization: `Bearer ${initialToken}`
        }
      });

      expect(replayRes.statusCode).toBe(401);
      const errBody = JSON.parse(replayRes.payload);
      expect(errBody.code).toBe("DEVICE_REVOKED");
    });

    it("rejects token refresh with 401 UNAUTHORIZED when presented with an invalid or malformed bearer token", async () => {
      const invalidRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/refresh-token",
        headers: {
          authorization: "Bearer invalid.fake.token"
        }
      });

      expect(invalidRes.statusCode).toBe(401);
    });

    it("rejects token refresh if the terminal device is marked suspended or decommissioned", async () => {
      // 1. Create a suspended device
      const token = app.jwt.sign(
        {
          deviceId: suspendedDeviceId,
          organizationId: orgId.toString(),
          role: "kiosk_device"
        },
        { expiresIn: "90d" }
      );
      const tokenRef = crypto.createHash("sha256").update(token).digest("hex");

      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId: suspendedDeviceId,
        hardwareGuid: suspendedDeviceId,
        name: "Suspended Terminal",
        location: "Warehouse",
        status: "suspended",
        paired: true,
        tokenRef,
        lastSeen: new Date(),
        currentContentVersion: 1,
        telemetry: {}
      });

      // 2. Attempt token refresh on suspended device
      const suspendedRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/refresh-token",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(suspendedRes.statusCode).toBe(401);
      const body = JSON.parse(suspendedRes.payload);
      expect(body.code).toBe("DEVICE_REVOKED");
    });
  });
});
