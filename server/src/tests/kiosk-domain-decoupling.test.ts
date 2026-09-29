import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { KIOSK_DEVICE_STATUSES } from "../modules/kiosk/constants/device.constants.js";
import { KioskDeviceStatus } from "../modules/kiosk/types/common.types.js";
import { KioskDeviceAssignment } from "../modules/kiosk/types/assignment.types.js";
import { KioskSession } from "../modules/kiosk/types/session.types.js";

describe("K-FND-001: Kiosk Domain Model Decoupling & Schema Verification", () => {
  let app: any;
  const testOrgId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await KioskDeviceModel.deleteMany({ organizationId: testOrgId });
    // Ensure all indexes on KioskDeviceModel are built
    await KioskDeviceModel.syncIndexes();
  });

  afterAll(async () => {
    await KioskDeviceModel.deleteMany({ organizationId: testOrgId });
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Status Enumeration Validation", () => {
    it("should accept all 6 canonical status values in KIOSK_DEVICE_STATUSES", async () => {
      const validStatuses: KioskDeviceStatus[] = [
        "staged",
        "online",
        "offline",
        "maintenance",
        "suspended",
        "decommissioned",
      ];

      expect(KIOSK_DEVICE_STATUSES).toEqual(validStatuses);

      for (let i = 0; i < validStatuses.length; i++) {
        const status = validStatuses[i];
        const device = new KioskDeviceModel({
          organizationId: testOrgId,
          deviceId: `status-test-hw-${status}-${i}`,
          hardwareGuid: `status-test-hw-${status}-${i}`,
          name: `Terminal ${status}`,
          location: `Area ${i}`,
          status,
          telemetry: {},
        });

        const saved = await device.save();
        expect(saved.status).toBe(status);
        expect(saved._id).toBeDefined();
      }
    });

    it("should reject an invalid status string on schema validation", async () => {
      const invalidDevice = new KioskDeviceModel({
        organizationId: testOrgId,
        deviceId: "status-test-invalid-hw",
        name: "Invalid Status Terminal",
        location: "Warehouse Floor",
        status: "invalid_status" as any,
        telemetry: {},
      });

      await expect(invalidDevice.validate()).rejects.toThrow();
    });
  });

  describe("Hardware Identity & Decoupling (ADR-003)", () => {
    it("should save device without macAddress and auto-populate hardwareGuid from deviceId if omitted", async () => {
      const deviceId = `hw-guid-auto-${Date.now()}`;
      const device = new KioskDeviceModel({
        organizationId: testOrgId,
        deviceId,
        name: "Touchscreen Terminal A",
        location: "Gate 1",
        status: "online",
        telemetry: {},
      });

      const saved = await device.save();
      expect(saved.macAddress).toBeUndefined();
      expect(saved.hardwareGuid).toBe(deviceId);
    });

    it("should trim hardwareGuid whitespace cleanly", async () => {
      const deviceId = `hw-guid-trim-${Date.now()}`;
      const explicitGuid = "   custom-hardware-uuid-777   ";
      const device = new KioskDeviceModel({
        organizationId: testOrgId,
        deviceId,
        hardwareGuid: explicitGuid,
        name: "Touchscreen Terminal B",
        location: "Gate 2",
        status: "staged",
        telemetry: {},
      });

      const saved = await device.save();
      expect(saved.hardwareGuid).toBe("custom-hardware-uuid-777");
    });

    it("should enforce uniqueness of deviceId index", async () => {
      const uniqueId = `unique-hw-${Date.now()}`;
      const first = new KioskDeviceModel({
        organizationId: testOrgId,
        deviceId: uniqueId,
        name: "Original Terminal",
        location: "Building 1",
        status: "online",
        telemetry: {},
      });
      await first.save();

      const duplicate = new KioskDeviceModel({
        organizationId: testOrgId,
        deviceId: uniqueId,
        name: "Duplicate Terminal",
        location: "Building 2",
        status: "online",
        telemetry: {},
      });

      await expect(duplicate.save()).rejects.toThrow(/duplicate key|E11000/i);
    });

    it("should store and retrieve SHA-256 tokenRef without exposing plain bearer tokens", async () => {
      const dummyToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_bearer_token";
      const sha256Ref = crypto.createHash("sha256").update(dummyToken).digest("hex");

      const device = await KioskDeviceModel.create({
        organizationId: testOrgId,
        deviceId: `token-ref-test-${Date.now()}`,
        name: "Secured Kiosk Terminal",
        location: "Cleanroom 5",
        status: "online",
        tokenRef: sha256Ref,
        telemetry: {},
      });

      expect(device.tokenRef).toBe(sha256Ref);
      expect(device.tokenRef).not.toContain("eyJ");
    });
  });

  describe("Backward Compatibility (ADR-001 Migration)", () => {
    it("should allow storing and querying existing documents that specify currentJourneyId", async () => {
      const legacyJourneyId = new mongoose.Types.ObjectId();
      const legacyDeviceId = `legacy-hw-${Date.now()}`;

      const legacyDevice = await KioskDeviceModel.create({
        organizationId: testOrgId,
        deviceId: legacyDeviceId,
        name: "Legacy Kiosk Terminal",
        location: "Dock 4",
        status: "online",
        currentJourneyId: legacyJourneyId,
        telemetry: {},
      });

      expect(legacyDevice.currentJourneyId?.toString()).toBe(legacyJourneyId.toString());

      const retrieved = await KioskDeviceModel.findOne({ deviceId: legacyDeviceId });
      expect(retrieved).not.toBeNull();
      expect(retrieved?.currentJourneyId?.toString()).toBe(legacyJourneyId.toString());
      expect(retrieved?.hardwareGuid).toBe(legacyDeviceId);
    });
  });

  describe("Decoupled Domain Entities Interface Verification", () => {
    it("should satisfy KioskDeviceAssignment and KioskSession TypeScript contracts", () => {
      const assignment: KioskDeviceAssignment = {
        _id: new mongoose.Types.ObjectId().toString(),
        organizationId: testOrgId.toString(),
        targetType: "device",
        targetId: new mongoose.Types.ObjectId().toString(),
        journeyId: new mongoose.Types.ObjectId().toString(),
        priority: 0,
        isMandatory: true,
        scheduling: {
          enabled: true,
          daysOfWeek: [1, 2, 3, 4, 5],
          startTimeUtc: "08:00",
          endTimeUtc: "17:00",
        },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(assignment.targetType).toBe("device");
      expect(assignment.priority).toBe(0);

      const session: KioskSession = {
        _id: new mongoose.Types.ObjectId().toString(),
        organizationId: testOrgId.toString(),
        deviceId: new mongoose.Types.ObjectId().toString(),
        journeyId: assignment.journeyId,
        versionNumber: 1,
        sessionToken: "ephemeral-token",
        status: "active",
        startedAt: new Date(),
        durationSeconds: 0,
        currentStepId: "step-1",
        completedStepIds: [],
        ppeItemsVerified: ["vest", "boots"],
        isOfflineSync: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(session.status).toBe("active");
      expect(session.ppeItemsVerified).toContain("vest");
    });
  });
});
