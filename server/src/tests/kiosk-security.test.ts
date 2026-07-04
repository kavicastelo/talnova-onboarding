import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskSecurityService,
  verifySignedUrl,
  verifyDeviceToken,
  KioskDeviceModel
} from "../modules/kiosk/index.js";
import AppError from "../common/errors/app-error.js";

import config from "../config/index.js";

describe("Kiosk Security & Cryptography Subsystem Tests", () => {
  let app: any;
  const securityService = new KioskSecurityService();
  const testSecret = "kiosk-super-secure-jwt-and-signing-secret-key-123456";
  const orgId = new mongoose.Types.ObjectId();
  const journeyId = new mongoose.Types.ObjectId();
  const deviceId = "kiosk-terminal-hardware-serial-987";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Setup mock organization in database
    await Organization.deleteMany({ name: "Kiosk Security Org" });
    await KioskDeviceModel.deleteMany({ deviceId });

    await Organization.create({
      _id: orgId,
      name: "Kiosk Security Org",
      slug: "kiosk-security-org",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: orgId });
    await KioskDeviceModel.deleteMany({ deviceId });

    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("HMAC Signed URL Sign & Verify Service", () => {
    it("should successfully generate and verify a valid signature", () => {
      const exp = Math.floor(Date.now() / 1000) + 60; // expires in 60s
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const isValid = securityService.verifySignature(journeyId.toString(), orgId.toString(), exp, sig, testSecret);
      expect(isValid).toBe(true);
    });

    it("should fail validation if journey ID is tampered", () => {
      const exp = Math.floor(Date.now() / 1000) + 60;
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const isValid = securityService.verifySignature("different-journey-id", orgId.toString(), exp, sig, testSecret);
      expect(isValid).toBe(false);
    });

    it("should fail validation if organization ID is tampered", () => {
      const exp = Math.floor(Date.now() / 1000) + 60;
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const isValid = securityService.verifySignature(journeyId.toString(), "different-org-id", exp, sig, testSecret);
      expect(isValid).toBe(false);
    });

    it("should fail validation if signature is expired", () => {
      const exp = Math.floor(Date.now() / 1000) - 10; // expired 10s ago
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const isValid = securityService.verifySignature(journeyId.toString(), orgId.toString(), exp, sig, testSecret);
      expect(isValid).toBe(false);
    });
  });

  describe("6-Digit Pairing Codes Manager", () => {
    it("should generate a unique 6-digit numeric pairing code string", () => {
      const code = securityService.generatePairingCode(orgId.toString(), deviceId);
      expect(code).toMatch(/^\d{6}$/);
    });

    it("should verify code and return registration details, then fail on second lookup (single-use guarantee)", () => {
      const code = securityService.generatePairingCode(orgId.toString(), deviceId);
      const data = securityService.verifyPairingCode(code);

      expect(data).not.toBeNull();
      expect(data?.orgId).toBe(orgId.toString());
      expect(data?.deviceId).toBe(deviceId);

      // Second check should be null
      const secondCheck = securityService.verifyPairingCode(code);
      expect(secondCheck).toBeNull();
    });

    it("should fail validation if pairing code is expired", async () => {
      const code = securityService.generatePairingCode(orgId.toString(), deviceId, 1); // 1ms TTL
      await new Promise((resolve) => setTimeout(resolve, 5));

      const data = securityService.verifyPairingCode(code);
      expect(data).toBeNull();
    });
  });

  describe("verifySignedUrl Fastify Hook Plugin", () => {
    it("should attach kioskContext correctly if signature is valid and tenant active", async () => {
      const exp = Math.floor(Date.now() / 1000) + 300;
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const request: any = {
        params: { id: journeyId.toString() },
        query: {
          o: orgId.toString(),
          exp: exp.toString(),
          sig
        }
      };
      const reply: any = {};

      // Temporarily mock environment secret config
      const originalSecret = config.jwt.secret;
      config.jwt.secret = testSecret;

      await verifySignedUrl(request, reply);

      expect(request.kioskContext).toBeDefined();
      expect(request.kioskContext?.organizationId).toBe(orgId.toString());
      expect(request.kioskContext?.journeyId).toBe(journeyId.toString());

      config.jwt.secret = originalSecret;
    });

    it("should block request if organization is suspended", async () => {
      // Suspend organization
      await Organization.findByIdAndUpdate(orgId, { status: "Suspended" });

      const exp = Math.floor(Date.now() / 1000) + 300;
      const sig = securityService.generateSignature(journeyId.toString(), orgId.toString(), exp, testSecret);

      const request: any = {
        params: { id: journeyId.toString() },
        query: {
          o: orgId.toString(),
          exp: exp.toString(),
          sig
        }
      };
      const reply: any = {};

      const originalSecret = config.jwt.secret;
      config.jwt.secret = testSecret;

      await expect(verifySignedUrl(request, reply)).rejects.toThrowError(
        new AppError(403, "FORBIDDEN", "Your organization has been suspended. Access denied.")
      );

      config.jwt.secret = originalSecret;

      // Reset org status
      await Organization.findByIdAndUpdate(orgId, { status: "Active" });
    });
  });

  describe("verifyDeviceToken Fastify Hook Plugin", () => {
    it("should allow request if device connection token matches active registry", async () => {
      // Seed registered device in database
      await KioskDeviceModel.create({
        organizationId: orgId,
        deviceId,
        name: "Heartbeat Terminal",
        location: "Hallway",
        status: "online",
        telemetry: {},
        currentContentVersion: 1
      });

      const request: any = {
        jwtVerify: async () => {},
        user: {
          deviceId,
          organizationId: orgId.toString(),
          role: "kiosk_device"
        }
      };
      const reply: any = {};

      await expect(verifyDeviceToken(request, reply)).resolves.not.toThrow();
    });

    it("should throw AppError if role claims in JWT are invalid", async () => {
      const request: any = {
        jwtVerify: async () => {},
        user: {
          deviceId,
          organizationId: orgId.toString(),
          role: "admin" // Wrong role
        }
      };
      const reply: any = {};

      await expect(verifyDeviceToken(request, reply)).rejects.toThrowError(
        new AppError(403, "FORBIDDEN", "Unauthorized. Device token signature required.")
      );
    });

    it("should throw AppError if device registry record is missing/revoked", async () => {
      await KioskDeviceModel.deleteMany({ deviceId });

      const request: any = {
        jwtVerify: async () => {},
        user: {
          deviceId,
          organizationId: orgId.toString(),
          role: "kiosk_device"
        }
      };
      const reply: any = {};

      await expect(verifyDeviceToken(request, reply)).rejects.toThrowError(
        new AppError(401, "UNAUTHORIZED", "Device registration has been revoked or suspended.")
      );
    });
  });
});
