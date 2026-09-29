import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import {
  KioskDeviceAssignmentModel,
  IKioskDeviceAssignment,
} from "../modules/kiosk/models/kiosk-assignment.model.js";
import { KioskDeviceAssignmentRepository } from "../modules/kiosk/repositories/kiosk-assignment.repository.js";
import { KioskDeviceRepository } from "../modules/kiosk/repositories/kiosk-device.repository.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import {
  CreateKioskAssignmentSchema,
  UpdateKioskAssignmentSchema,
} from "../modules/kiosk/validation/assignment.schema.js";

describe("K-FND-002: Kiosk Device Assignment Model & Repository Suite", () => {
  let app: any;
  const orgAId = new mongoose.Types.ObjectId();
  const orgBId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const repo = new KioskDeviceAssignmentRepository();
  const deviceRepo = new KioskDeviceRepository();

  let testJourneyId: mongoose.Types.ObjectId;
  let testDeviceId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean test collections
    await KioskDeviceAssignmentModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskDeviceModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskJourneyModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });

    // Ensure model indexes are synchronized
    await KioskDeviceAssignmentModel.syncIndexes();

    // Create a dummy journey
    const journey = await KioskJourneyModel.create({
      organizationId: orgAId,
      title: "Warehouse Shift Safety Briefing",
      languages: ["en"],
      steps: [],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: true,
        security: { protectionType: "none" },
      },
      publishing: { status: "published", version: 1 },
      createdBy: userId,
    });
    testJourneyId = journey._id as mongoose.Types.ObjectId;

    // Create a dummy device
    const device = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: `assignment-test-hw-${Date.now()}`,
      name: "Assembly Station 4 Terminal",
      location: "Building C",
      status: "online",
      telemetry: {},
    });
    testDeviceId = device._id as mongoose.Types.ObjectId;
  });

  afterAll(async () => {
    await KioskDeviceAssignmentModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskDeviceModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await KioskJourneyModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId] },
    });
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Schema Validation & Default Values", () => {
    it("should successfully save an assignment with default priority: 0, isMandatory: false, and isActive: true", async () => {
      const assignment = new KioskDeviceAssignmentModel({
        organizationId: orgAId,
        targetType: "device",
        targetId: testDeviceId,
        journeyId: testJourneyId,
        assignedBy: userId,
      });

      const saved = await assignment.save();
      expect(saved._id).toBeDefined();
      expect(saved.priority).toBe(0);
      expect(saved.isMandatory).toBe(false);
      expect(saved.isActive).toBe(true);
      expect(saved.scheduling.enabled).toBe(false);
      expect(saved.createdAt).toBeInstanceOf(Date);
      expect(saved.updatedAt).toBeInstanceOf(Date);
    });

    it("should reject an invalid targetType (e.g. 'user') with Mongoose ValidationError", async () => {
      const invalidDoc = new KioskDeviceAssignmentModel({
        organizationId: orgAId,
        targetType: "user" as any,
        targetId: testDeviceId,
        journeyId: testJourneyId,
        assignedBy: userId,
      });

      await expect(invalidDoc.validate()).rejects.toThrow();
    });

    it("should support targetType 'device_group' and 'site'", async () => {
      const groupTargetId = new mongoose.Types.ObjectId();
      const siteTargetId = new mongoose.Types.ObjectId();

      const groupAssignment = await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: groupTargetId,
        journeyId: testJourneyId,
        assignedBy: userId,
      });
      expect(groupAssignment.targetType).toBe("device_group");

      const siteAssignment = await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "site",
        targetId: siteTargetId,
        journeyId: testJourneyId,
        assignedBy: userId,
      });
      expect(siteAssignment.targetType).toBe("site");
    });

    it("should persist scheduling sub-schema with daysOfWeek, startTimeUtc, and endTimeUtc", async () => {
      const scheduledDoc = await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: testDeviceId,
        journeyId: testJourneyId,
        assignedBy: userId,
        priority: 1,
        scheduling: {
          enabled: true,
          startDate: new Date("2026-10-01"),
          endDate: new Date("2026-12-31"),
          daysOfWeek: [1, 2, 3, 4, 5],
          startTimeUtc: "06:00",
          endTimeUtc: "18:00",
        },
      });

      expect(scheduledDoc.scheduling.enabled).toBe(true);
      expect(scheduledDoc.scheduling.daysOfWeek).toEqual([1, 2, 3, 4, 5]);
      expect(scheduledDoc.scheduling.startTimeUtc).toBe("06:00");
      expect(scheduledDoc.scheduling.endTimeUtc).toBe("18:00");
    });
  });

  describe("Compound Indexes Verification", () => {
    it("should define expected compound indexes on KioskDeviceAssignmentSchema", () => {
      const indexes = KioskDeviceAssignmentModel.schema.indexes();
      const indexKeys = indexes.map((idx) => Object.keys(idx[0]).join(","));

      // Check compound index: organizationId, targetType, targetId, isActive
      expect(indexKeys).toContain("organizationId,targetType,targetId,isActive");
      // Check compound index: organizationId, journeyId
      expect(indexKeys).toContain("organizationId,journeyId");
    });
  });

  describe("Repository CRUD & Tenant Boundary Enforcement", () => {
    let createdAssignmentId: mongoose.Types.ObjectId;
    const commonTargetId = new mongoose.Types.ObjectId();

    beforeAll(async () => {
      // Seed an active and inactive assignment in Org A
      const activeDoc = await repo.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: commonTargetId,
        journeyId: testJourneyId,
        priority: 5,
        isActive: true,
        assignedBy: userId,
      });
      createdAssignmentId = activeDoc._id as mongoose.Types.ObjectId;

      await repo.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: commonTargetId,
        journeyId: testJourneyId,
        priority: 10,
        isActive: false,
        assignedBy: userId,
      });

      // Seed an assignment in Org B with same targetId
      await repo.create({
        organizationId: orgBId,
        targetType: "device",
        targetId: commonTargetId,
        journeyId: testJourneyId,
        priority: 1,
        isActive: true,
        assignedBy: userId,
      });
    });

    it("should find an assignment by ID within the matching organization", async () => {
      const found = await repo.findById(createdAssignmentId, orgAId);
      expect(found).not.toBeNull();
      expect(found?._id.toString()).toBe(createdAssignmentId.toString());
    });

    it("should return null when querying an assignment belonging to another organization (Tenant Isolation)", async () => {
      const crossTenant = await repo.findById(createdAssignmentId, orgBId);
      expect(crossTenant).toBeNull();
    });

    it("findActiveByTarget should return only active assignments belonging strictly to the specified org", async () => {
      const orgAActive = await repo.findActiveByTarget(commonTargetId, orgAId);
      expect(orgAActive.length).toBe(1);
      expect(orgAActive[0].isActive).toBe(true);
      expect(orgAActive[0].organizationId.toString()).toBe(orgAId.toString());
      expect(orgAActive[0].priority).toBe(5);

      const orgBActive = await repo.findActiveByTarget(commonTargetId, orgBId);
      expect(orgBActive.length).toBe(1);
      expect(orgBActive[0].organizationId.toString()).toBe(orgBId.toString());
      expect(orgBActive[0].priority).toBe(1);
    });

    it("findByJourney should return assignments for a journey within tenant", async () => {
      const results = await repo.findByJourney(testJourneyId, orgAId);
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((item) => {
        expect(item.organizationId.toString()).toBe(orgAId.toString());
      });
    });

    it("update should modify assignment fields within tenant", async () => {
      const updated = await repo.update(createdAssignmentId, orgAId, {
        priority: 1,
        isMandatory: true,
      });

      expect(updated).not.toBeNull();
      expect(updated?.priority).toBe(1);
      expect(updated?.isMandatory).toBe(true);
    });

    it("update should not modify assignment if orgId does not match", async () => {
      const failedUpdate = await repo.update(createdAssignmentId, orgBId, {
        priority: 99,
      });
      expect(failedUpdate).toBeNull();
    });

    it("delete should remove the assignment within tenant", async () => {
      const deleted = await repo.delete(createdAssignmentId, orgAId);
      expect(deleted).toBe(true);

      const check = await repo.findById(createdAssignmentId, orgAId);
      expect(check).toBeNull();
    });
  });

  describe("Validation Schemas Integration", () => {
    it("CreateKioskAssignmentSchema should validate a valid payload", () => {
      const validPayload = {
        targetType: "device",
        targetId: testDeviceId.toString(),
        journeyId: testJourneyId.toString(),
        priority: 2,
        isMandatory: true,
        scheduling: {
          enabled: true,
          daysOfWeek: [1, 3, 5],
          startTimeUtc: "09:00",
          endTimeUtc: "17:00",
        },
        isActive: true,
      };

      const result = CreateKioskAssignmentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("CreateKioskAssignmentSchema should reject an invalid targetType", () => {
      const invalidPayload = {
        targetType: "unknown_target",
        targetId: testDeviceId.toString(),
        journeyId: testJourneyId.toString(),
      };

      const result = CreateKioskAssignmentSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
    });
  });

  describe("Regression Check: pairJourney Fallback", () => {
    it("should continue to support existing pairJourney method in KioskDeviceRepository", async () => {
      const paired = await deviceRepo.pairJourney(testDeviceId, testJourneyId);
      expect(paired).not.toBeNull();
      expect(paired?.currentJourneyId?.toString()).toBe(testJourneyId.toString());

      // Unpair journey
      const unpaired = await deviceRepo.pairJourney(testDeviceId, null);
      expect(unpaired).not.toBeNull();
      expect(unpaired?.currentJourneyId).toBeUndefined();
    });
  });
});
