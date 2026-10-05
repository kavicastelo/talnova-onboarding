import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskPairingCodeModel,
  KioskDeviceModel,
  KioskSecurityService
} from "../modules/kiosk/index.js";

describe("K-DEV-002: Persistent CSPRNG Kiosk Pairing Handshake Suite", () => {
  let app: any;
  let orgId: mongoose.Types.ObjectId;
  let adminUser: any;
  let adminToken: string;
  const securityService = new KioskSecurityService();

  const testDeviceId = "hw-guid-f47ac10b-58cc-4372-a567-0e02b2c3d479";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test data
    await Organization.deleteMany({ slug: "kiosk-pairing-persistent-org" });
    await User.deleteMany({ "auth.email": "kiosk-pairing-admin@test.com" });
    await KioskPairingCodeModel.deleteMany({});
    await KioskDeviceModel.deleteMany({ deviceId: { $regex: /^hw-guid-/ } });

    // Seed test organization
    const org = await Organization.create({
      name: "Kiosk Pairing Test Org",
      slug: "kiosk-pairing-persistent-org",
      status: "Active",
      limits: {
        maxKiosks: 5
      },
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgId = org._id as mongoose.Types.ObjectId;

    // Seed admin user
    adminUser = await User.create({
      organizationId: orgId,
      auth: {
        email: "kiosk-pairing-admin@test.com",
        passwordHash: "placeholder-hash",
        failedLoginAttempts: 0
      },
      profile: { firstName: "Kiosk", lastName: "Admin" },
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
    await KioskPairingCodeModel.deleteMany({ organizationId: orgId });
    await KioskDeviceModel.deleteMany({ organizationId: orgId });

    await app.close();
    await disconnectDatabase(app.log);
  });

  beforeEach(async () => {
    await securityService.clearPairingCodes();
  });

  describe("1. Generation with CSPRNG Entropy & MongoDB Persistence", () => {
    it("generates a cryptographically secure 6-digit numeric pairing code and stores in MongoDB with a 15-minute TTL", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          deviceId: testDeviceId
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.code).toBeDefined();
      expect(body.code).toMatch(/^\d{6}$/);
      expect(body.expiresInSeconds).toBe(900);

      // Verify MongoDB document persistence
      const persistedRecord = await KioskPairingCodeModel.findOne({ code: body.code });
      expect(persistedRecord).not.toBeNull();
      expect(persistedRecord!.organizationId.toString()).toBe(orgId.toString());
      expect(persistedRecord!.deviceId).toBe(testDeviceId);
      expect(persistedRecord!.consumed).toBe(false);
      expect(persistedRecord!.attemptsCount).toBe(0);

      // Verify 15-minute TTL bounds (approx 900 seconds in future)
      const now = Date.now();
      const expiresAtMs = new Date(persistedRecord!.expiresAt).getTime();
      expect(expiresAtMs).toBeGreaterThan(now + 850 * 1000);
      expect(expiresAtMs).toBeLessThanOrEqual(now + 905 * 1000);
    });

    it("ensures indexes including TTL index exist on the KioskPairingCode collection", async () => {
      const indexes = await KioskPairingCodeModel.collection.indexes();
      const ttlIndex = indexes.find((idx: any) => idx.key?.expiresAt === 1);
      expect(ttlIndex).toBeDefined();
      expect(ttlIndex.expireAfterSeconds).toBe(0);

      const codeIndex = indexes.find((idx: any) => idx.key?.code === 1);
      expect(codeIndex).toBeDefined();
    });
  });

  describe("2. Single-Use Atomic Consumption", () => {
    it("consumes pairing code atomically and issues long-lived device JWT and registers device", async () => {
      // 1. Generate code
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

      // 2. Submit pairing handshake from terminal
      const pairRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: testDeviceId,
          name: "Reception Check-In Terminal",
          location: "Ground Floor East Lobby"
        }
      });

      expect(pairRes.statusCode).toBe(200);
      const pairBody = JSON.parse(pairRes.payload);
      expect(pairBody.success).toBe(true);
      expect(pairBody.deviceToken).toBeDefined();
      expect(pairBody.device).toBeDefined();
      expect(pairBody.device.status).toBe("online");

      // Verify pairing code is marked consumed in MongoDB
      const codeInDb = await KioskPairingCodeModel.findOne({ code });
      expect(codeInDb).not.toBeNull();
      expect(codeInDb!.consumed).toBe(true);
      expect(codeInDb!.consumedAt).toBeInstanceOf(Date);
      expect(codeInDb!.attemptsCount).toBeGreaterThanOrEqual(1);

      // Verify device model persisted in MongoDB
      const deviceInDb = await KioskDeviceModel.findOne({ deviceId: testDeviceId });
      expect(deviceInDb).not.toBeNull();
      expect(deviceInDb!.name).toBe("Reception Check-In Terminal");
      expect(deviceInDb!.paired).toBe(true);
      expect(deviceInDb!.status).toBe("online");
    });
  });

  describe("3. Replay Attack & Brute Force Rejection", () => {
    it("rejects reusing an already consumed pairing code with 400 INVALID_OR_EXPIRED_PAIRING_CODE", async () => {
      const replayDeviceId = "hw-guid-replay-test-123";

      // 1. Generate code
      const codeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          deviceId: replayDeviceId
        }
      });
      const { code } = JSON.parse(codeRes.payload);

      // 2. First pairing succeeds
      const firstPair = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: replayDeviceId,
          name: "Original Terminal",
          location: "Gate 1"
        }
      });
      expect(firstPair.statusCode).toBe(200);

      // 3. Second pairing attempt using the EXACT same code must be rejected (Replay Attack)
      const secondPair = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: replayDeviceId,
          name: "Impostor Terminal",
          location: "Gate 2"
        }
      });

      expect(secondPair.statusCode).toBe(400);
      const errorBody = JSON.parse(secondPair.payload);
      expect(errorBody.code).toBe("INVALID_OR_EXPIRED_PAIRING_CODE");
    });

    it("rejects pairing when code was generated for a different hardware GUID (Device Mismatch)", async () => {
      const code = await securityService.generatePairingCode(orgId.toString(), "authorized-hardware-guid-001");

      const pairAttempt = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: "rogue-hardware-guid-999",
          name: "Unauthorized Terminal",
          location: "Parking"
        }
      });

      expect(pairAttempt.statusCode).toBe(400);
      const errorBody = JSON.parse(pairAttempt.payload);
      expect(errorBody.code).toBe("DEVICE_MISMATCH");
      expect(errorBody.expectedGuid).toBe("authorized-hardware-guid-001");
      expect(errorBody.actualGuid).toBe("rogue-hardware-guid-999");
    });

    it("successfully normalizes and pairs when code was generated with 'Terminal Hardware GUID:' label prefix", async () => {
      const pureGuid = "hw-guid-clean-target-999";
      const codeRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${adminToken}`
        },
        payload: {
          deviceId: `Terminal Hardware GUID: ${pureGuid}`
        }
      });

      expect(codeRes.statusCode).toBe(200);
      const { code } = JSON.parse(codeRes.payload);

      const pairRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code,
          deviceId: pureGuid,
          name: "Prefix Cleaned Terminal",
          location: "Gate 5"
        }
      });

      expect(pairRes.statusCode).toBe(200);
      const pairBody = JSON.parse(pairRes.payload);
      expect(pairBody.success).toBe(true);
      expect(pairBody.device.status).toBe("online");
    });

    it("triggers rate limiting after 5 consecutive failed pairing attempts on a deviceId", async () => {
      const attackDeviceId = "hw-guid-brute-force-attacker";

      for (let i = 0; i < 5; i++) {
        const failRes = await app.inject({
          method: "POST",
          url: "/api/v1/kiosk/devices/pair",
          payload: {
            code: "999999", // non-existent code
            deviceId: attackDeviceId,
            name: "Brute Force Terminal",
            location: "Nowhere"
          }
        });
        expect(failRes.statusCode).toBe(400);
      }

      // 6th attempt should be blocked by rate limiter with 429
      const rateLimitedRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code: "999999",
          deviceId: attackDeviceId,
          name: "Brute Force Terminal",
          location: "Nowhere"
        }
      });

      expect(rateLimitedRes.statusCode).toBe(429);
      const body = JSON.parse(rateLimitedRes.payload);
      expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
    });
  });

  describe("4. Quota Enforcement Rejection", () => {
    it("rejects pairing code generation when organization kiosk quota is exhausted", async () => {
      // Create a restricted organization with maxKiosks = 1
      const restrictedOrg = await Organization.create({
        name: "Restricted Quota Org",
        slug: "restricted-kiosk-quota-org",
        status: "Active",
        limits: {
          maxKiosks: 1
        },
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      });

      const restrictedAdmin = await User.create({
        organizationId: restrictedOrg._id,
        auth: { email: "restricted-admin@test.com", passwordHash: "placeholder" },
        profile: { firstName: "Restricted", lastName: "Admin" },
        permissions: { role: "admin" },
        employment: { status: "active" },
        isDeleted: false
      });

      const restrictedToken = app.jwt.sign({
        userId: restrictedAdmin._id.toString(),
        organizationId: restrictedOrg._id.toString(),
        role: "admin"
      });

      // 1. Seed 1 active kiosk device to exhaust quota (1/1)
      await KioskDeviceModel.create({
        organizationId: restrictedOrg._id,
        deviceId: "hw-guid-existing-quota-kiosk-1",
        hardwareGuid: "hw-guid-existing-quota-kiosk-1",
        name: "First Terminal",
        location: "Hall A",
        status: "online",
        paired: true,
        lastSeen: new Date(),
        currentContentVersion: 1,
        telemetry: {}
      });

      // 2. Requesting pairing code for a NEW device must be rejected with 403 KIOSK_LIMIT_REACHED
      const quotaExceededRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: {
          authorization: `Bearer ${restrictedToken}`
        },
        payload: {
          deviceId: "hw-guid-second-kiosk-over-limit"
        }
      });

      expect(quotaExceededRes.statusCode).toBe(403);
      const quotaBody = JSON.parse(quotaExceededRes.payload);
      expect(quotaBody.code).toBe("KIOSK_LIMIT_REACHED");

      // Cleanup
      await Organization.deleteMany({ _id: restrictedOrg._id });
      await User.deleteMany({ _id: restrictedAdmin._id });
      await KioskDeviceModel.deleteMany({ organizationId: restrictedOrg._id });
    });
  });
});
