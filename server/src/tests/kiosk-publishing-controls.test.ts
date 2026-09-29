import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskJourneyVersionModel,
  KioskDeviceModel,
  KioskDeviceAssignmentModel,
  KioskPublishingScheduler
} from "../modules/kiosk/index.js";
import crypto from "crypto";

const defaultSettings = {
  autoPlay: false,
  loopForever: false,
  idleTimeoutSeconds: 60,
  autoReturnHome: true,
  hideNavigation: false,
  disableExit: true,
  security: { protectionType: "none" }
};

describe("Kiosk Enterprise Publishing Controls (K-JRN-002)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;
  let adminAToken: string;
  let adminBToken: string;
  let deviceA: any;
  let deviceAToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test organizations and users
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["kiosk-pub-ctrl-org-a", "kiosk-pub-ctrl-org-b"] } }),
      User.deleteMany({ "auth.email": { $in: ["kiosk-pub-admin-a@test.com", "kiosk-pub-admin-b@test.com"] } }),
      KioskDeviceModel.deleteMany({ deviceId: { $in: ["kiosk-device-guid-ctrl-001", "kiosk-device-suspended-001"] } })
    ]);

    const [orgA, orgB] = await Promise.all([
      Organization.create({
        name: "Publishing Controls Org A",
        slug: "kiosk-pub-ctrl-org-a",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      }),
      Organization.create({
        name: "Publishing Controls Org B",
        slug: "kiosk-pub-ctrl-org-b",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      })
    ]);
    orgAId = orgA._id as mongoose.Types.ObjectId;
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Seed admin users in parallel
    const [adminA, adminB] = await Promise.all([
      User.create({
        organizationId: orgAId,
        auth: { email: "kiosk-pub-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Admin", lastName: "A" },
        permissions: { role: "admin" },
        employment: { status: "active" },
        isDeleted: false
      }),
      User.create({
        organizationId: orgBId,
        auth: { email: "kiosk-pub-admin-b@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Admin", lastName: "B" },
        permissions: { role: "admin" },
        employment: { status: "active" },
        isDeleted: false
      })
    ]);
    adminAUser = adminA;
    adminBUser = adminB;

    adminAToken = app.jwt.sign({
      userId: adminAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "admin"
    });

    adminBToken = app.jwt.sign({
      userId: adminBUser._id.toString(),
      organizationId: orgBId.toString(),
      role: "admin"
    });

    // Create a paired test kiosk device for Org A
    const rawDeviceToken = "kiosk-test-device-raw-jwt-token-12345";
    const hashedTokenRef = crypto.createHash("sha256").update(rawDeviceToken).digest("hex");

    deviceA = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-guid-ctrl-001",
      name: "Terminal Frontline 01",
      location: "Building C Warehouse",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: hashedTokenRef,
      tokenExpiresAt: new Date(Date.now() + 90 * 86400000),
      isDeleted: false
    });

    deviceAToken = app.jwt.sign({
      role: "kiosk_device",
      deviceId: "kiosk-device-guid-ctrl-001",
      organizationId: orgAId.toString()
    });
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } }),
      adminAUser && adminBUser ? User.deleteMany({ _id: { $in: [adminAUser._id, adminBUser._id] } }) : Promise.resolve(),
      KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskJourneyVersionModel.collection.deleteMany({
        organizationId: { $in: [orgAId, orgBId] }
      }),
      KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } })
    ]);

    await app.close();
    await disconnectDatabase(app.log);
  }, 60000);

  beforeEach(async () => {
    await Promise.all([
      KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskJourneyVersionModel.collection.deleteMany({
        organizationId: { $in: [orgAId, orgBId] }
      }),
      KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } })
    ]);
  });

  describe("Scheduled Publishing Pipeline", () => {
    it("should schedule a journey for future publication and set status to 'scheduled'", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000); // 1 hour ahead
      const expiryDate = new Date(Date.now() + 7200 * 1000); // 2 hours ahead

      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Future Safety Protocol",
        description: "Scheduled for next shift",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Safety Briefing",
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "step-complete",
            type: "completion",
            title: "Safety Completion",
            order: 1,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "draft",
          version: 1
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/publish`,
        headers: {
          authorization: `Bearer ${adminAToken}`
        },
        payload: {
          changelog: "Scheduled for next shift rollout",
          scheduling: {
            publishAt: futureDate.toISOString(),
            expiresAt: expiryDate.toISOString()
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const json = JSON.parse(response.body);
      expect(json.success).toBe(true);
      expect(json.data.publishing.status).toBe("scheduled");
      expect(new Date(json.data.publishing.scheduling.publishAt).getTime()).toBe(futureDate.getTime());
      expect(new Date(json.data.publishing.scheduling.expiresAt).getTime()).toBe(expiryDate.getTime());

      // Terminal requests manifest: scheduled journey MUST NOT appear yet
      await KioskDeviceModel.findByIdAndUpdate(deviceA._id, { currentJourneyId: journey._id });

      const manifestRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/manifest`,
        headers: {
          authorization: `Bearer ${adminAToken}`
        }
      });

      expect(manifestRes.statusCode).toBe(200);
      const manifestJson = JSON.parse(manifestRes.body);
      expect(manifestJson.data.journeys).toHaveLength(0);
    });

    it("should reject publication if expiresAt is before or equal to publishAt", async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      const invalidExpiryDate = new Date(Date.now() + 1800 * 1000); // Earlier than publishAt

      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Invalid Scheduling Journey",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Intro",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: { status: "draft", version: 1 },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/publish`,
        headers: {
          authorization: `Bearer ${adminAToken}`
        },
        payload: {
          scheduling: {
            publishAt: futureDate.toISOString(),
            expiresAt: invalidExpiryDate.toISOString()
          }
        }
      });

      expect(response.statusCode).toBe(400);
      const json = JSON.parse(response.body);
      expect(json.message).toContain("Expiration date must be after scheduled publication date");
    });

    it("should activate scheduled journeys when background scheduler runs past publishAt", async () => {
      const publishAt = new Date(Date.now() - 60 * 1000); // 1 minute in the past
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour in the future

      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Ready to Activate Journey",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Active Check",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "scheduled",
          version: 1,
          scheduling: {
            publishAt,
            expiresAt
          }
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const scheduler = new KioskPublishingScheduler();
      const result = await scheduler.process(new Date());

      expect(result.activated).toContain(journey._id.toString());

      const updatedJourney = await KioskJourneyModel.findById(journey._id);
      expect(updatedJourney?.publishing.status).toBe("published");

      // Verify that device manifest now contains the activated journey
      await KioskDeviceModel.findByIdAndUpdate(deviceA._id, { currentJourneyId: journey._id });

      const manifestRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/manifest`,
        headers: {
          authorization: `Bearer ${adminAToken}`
        }
      });

      expect(manifestRes.statusCode).toBe(200);
      const manifestJson = JSON.parse(manifestRes.body);
      expect(manifestJson.data.journeys).toHaveLength(1);
      expect(manifestJson.data.journeys[0]._id.toString()).toBe(journey._id.toString());
    });
  });

  describe("Automatic Expiration and Terminal Manifest Filtering (Acceptance Criterion 1)", () => {
    it("Given a journey with expiresAt in the past, when a terminal requests its assigned manifest, then the expired journey is omitted from eligible results", async () => {
      const pastExpiry = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const futureExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour in future

      // 1. Expired Journey assigned to deviceA
      const expiredJourney = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Expired Regulation Checklist",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Outdated Steps",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(Date.now() - 7200 * 1000),
          scheduling: {
            expiresAt: pastExpiry
          }
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      // 2. Active Valid Journey
      const validJourney = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Current Valid Regulation Checklist",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Active Standard",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(Date.now() - 1000),
          scheduling: {
            expiresAt: futureExpiry
          }
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      // Assign both to deviceA: expired via currentJourneyId, valid via KioskDeviceAssignmentModel
      await KioskDeviceModel.findByIdAndUpdate(deviceA._id, { currentJourneyId: expiredJourney._id });
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: validJourney._id,
        priority: 1,
        isActive: true,
        assignedBy: adminAUser._id,
        createdBy: adminAUser._id
      });

      // Terminal requests its assigned manifest via device token or admin token
      const manifestRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/manifest`,
        headers: {
          authorization: `Bearer ${adminAToken}`
        }
      });

      expect(manifestRes.statusCode).toBe(200);
      const manifestJson = JSON.parse(manifestRes.body);
      const journeys = manifestJson.data.journeys;

      // The expired journey MUST be omitted from eligible results
      expect(journeys).toHaveLength(1);
      expect(journeys[0]._id.toString()).toBe(validJourney._id.toString());
      expect(journeys.find((j: any) => j._id.toString() === expiredJourney._id.toString())).toBeUndefined();
    });

    it("should archive expired journeys when the background scheduler executes", async () => {
      const pastExpiry = new Date(Date.now() - 5000);

      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Journey to be Archived",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Outdated Steps",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "published",
          version: 1,
          publishedAt: new Date(Date.now() - 3600 * 1000),
          scheduling: {
            expiresAt: pastExpiry
          }
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const scheduler = new KioskPublishingScheduler();
      const result = await scheduler.process(new Date());

      expect(result.expired).toContain(journey._id.toString());

      const updated = await KioskJourneyModel.findById(journey._id);
      expect(updated?.publishing.status).toBe("archived");
    });
  });

  describe("Unpublish Workflow", () => {
    it("should revert journey status to draft and immediately omit it from terminal manifests", async () => {
      // 1. Create and publish journey
      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Factory Safety Walkthrough",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Emergency Exits",
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "step-complete",
            type: "completion",
            title: "Emergency Completion",
            order: 1,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: {
          status: "draft",
          version: 1
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      // Publish it
      const pubRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { changelog: "Initial production release" }
      });
      expect(pubRes.statusCode).toBe(200);

      // Assign to device
      await KioskDeviceModel.findByIdAndUpdate(deviceA._id, { currentJourneyId: journey._id });

      // Verify it appears in terminal manifest
      const manifest1 = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      expect(JSON.parse(manifest1.body).data.journeys).toHaveLength(1);

      // 2. Unpublish journey
      const unpubRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/unpublish`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(unpubRes.statusCode).toBe(200);
      const unpubJson = JSON.parse(unpubRes.body);
      expect(unpubJson.success).toBe(true);
      expect(unpubJson.data.publishing.status).toBe("draft");

      // Verify database document
      const dbJourney = await KioskJourneyModel.findById(journey._id);
      expect(dbJourney?.publishing.status).toBe("draft");

      // 3. Terminal requests manifest: must now be omitted!
      const manifest2 = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      expect(JSON.parse(manifest2.body).data.journeys).toHaveLength(0);
    });
  });

  describe("Rollback Workflow (Acceptance Criterion 2)", () => {
    it("Given an admin triggering rollback to Version 1, When executed, Then Version 3 is published containing identical content to Version 1", async () => {
      // 1. Create Journey and publish as Version 1
      const v1Steps = [
        {
          id: "step-1",
          type: "instruction_step",
          title: "Version 1 Step 1",
          order: 0,
          interaction: { type: "tap_to_continue" }
        },
        {
          id: "step-complete",
          type: "completion",
          title: "Version 1 Complete",
          order: 1,
          interaction: { type: "tap_to_continue" }
        }
      ];

      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Rollback Test Journey v1",
        description: "Original Version 1 Content",
        languages: ["en"],
        steps: v1Steps,
        settings: defaultSettings,
        publishing: {
          status: "draft",
          version: 1
        },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const pubRes1 = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { changelog: "Release v1" }
      });
      expect(pubRes1.statusCode).toBe(200);
      const v1Data = JSON.parse(pubRes1.body).data;
      expect(v1Data.publishing.version).toBe(1);

      // Verify v1 snapshot exists in collection
      const v1Snapshot = await KioskJourneyVersionModel.findOne({
        journeyId: journey._id,
        version: 1
      });
      expect(v1Snapshot).toBeDefined();
      expect(v1Snapshot?.steps).toHaveLength(2);
      expect(v1Snapshot?.steps[0].title).toBe("Version 1 Step 1");
      const v1Checksum = v1Snapshot?.contentChecksum;
      expect(v1Checksum).toBeDefined();

      // 2. Modify journey steps and publish as Version 2
      const v2Steps = [
        {
          id: "step-v2-1",
          type: "instruction_step",
          title: "Corrupted / Buggy Step v2",
          order: 0,
          interaction: { type: "tap_to_continue" }
        },
        {
          id: "step-v2-complete",
          type: "completion",
          title: "Completion Step v2",
          order: 1,
          interaction: { type: "tap_to_continue" }
        }
      ];

      journey.steps = v2Steps as any;
      journey.title = "Rollback Test Journey v2 (Defective)";
      await journey.save();

      const pubRes2 = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { changelog: "Release v2 with bug" }
      });
      expect(pubRes2.statusCode).toBe(200);
      const v2Data = JSON.parse(pubRes2.body).data;
      expect(v2Data.publishing.version).toBe(2);

      const v2Snapshot = await KioskJourneyVersionModel.findOne({
        journeyId: journey._id,
        version: 2
      });
      expect(v2Snapshot?.steps).toHaveLength(2);
      expect(v2Snapshot?.steps[0].title).toBe("Corrupted / Buggy Step v2");

      // 3. Admin triggers rollback to Version 1: POST /api/v1/kiosk/journeys/:id/rollback/1
      const rollbackRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/rollback/1`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(rollbackRes.statusCode).toBe(200);
      const rollbackJson = JSON.parse(rollbackRes.body);
      expect(rollbackJson.success).toBe(true);

      // Acceptance Criterion: Version 3 is published containing identical content to Version 1
      const rolledBackJourney = rollbackJson.data;
      expect(rolledBackJourney.publishing.version).toBe(3);
      expect(rolledBackJourney.publishing.status).toBe("published");
      expect(rolledBackJourney.title).toBe(v1Snapshot?.title);
      expect(rolledBackJourney.steps).toHaveLength(2);
      expect(rolledBackJourney.steps[0].title).toBe("Version 1 Step 1");
      expect(rolledBackJourney.steps[1].title).toBe("Version 1 Complete");

      // Verify immutable Version 3 snapshot was created
      const v3Snapshot = await KioskJourneyVersionModel.findOne({
        journeyId: journey._id,
        version: 3
      });
      expect(v3Snapshot).toBeDefined();
      expect(v3Snapshot?.version).toBe(3);
      expect(v3Snapshot?.status).toBe("published");
      expect(v3Snapshot?.changelog).toBe("Rollback to version 1");
      expect(v3Snapshot?.contentChecksum).toBe(v1Checksum);
      expect(v3Snapshot?.steps).toHaveLength(2);
      expect(v3Snapshot?.steps[0].title).toBe("Version 1 Step 1");
      expect(v3Snapshot?.steps[1].title).toBe("Version 1 Complete");

      // Ensure Version 1 and Version 2 snapshots were NOT mutated
      const recheckedV1 = await KioskJourneyVersionModel.findOne({ journeyId: journey._id, version: 1 });
      const recheckedV2 = await KioskJourneyVersionModel.findOne({ journeyId: journey._id, version: 2 });
      expect(recheckedV1?.contentChecksum).toBe(v1Checksum);
      expect(recheckedV2?.steps[0].title).toBe("Corrupted / Buggy Step v2");
    });

    it("should return 404 when attempting to rollback to a non-existent version", async () => {
      const journey = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Single Version Journey",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Step 1",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: { status: "draft", version: 1 },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journey._id}/rollback/99`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(response.statusCode).toBe(404);
      const json = JSON.parse(response.body);
      expect(json.message).toContain("Target journey version 99 not found");
    });
  });

  describe("Tenant Isolation and Edge Cases", () => {
    it("should prevent cross-tenant unpublish or rollback", async () => {
      const journeyA = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Org A Secure Journey",
        languages: ["en"],
        steps: [
          {
            id: "step-1",
            type: "instruction_step",
            title: "Private step",
            order: 0,
            interaction: { type: "tap_to_continue" }
          }
        ],
        settings: defaultSettings,
        publishing: { status: "published", version: 1 },
        createdBy: adminAUser._id,
        isDeleted: false
      });

      // Admin B attempts to unpublish Org A's journey
      const unpubRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyA._id}/unpublish`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });
      expect(unpubRes.statusCode).toBe(404);

      // Admin B attempts to rollback Org A's journey
      const rollbackRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyA._id}/rollback/1`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });
      expect(rollbackRes.statusCode).toBe(404);
    });

    it("should deny manifest access to suspended or decommissioned devices", async () => {
      const suspendedDevice = await KioskDeviceModel.create({
        organizationId: orgAId,
        deviceId: "kiosk-device-suspended-001",
        name: "Suspended Terminal",
        location: "Warehouse D",
        status: "suspended",
        paired: true,
        tokenRef: "hash",
        isDeleted: false
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${suspendedDevice._id}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(response.statusCode).toBe(403);
      const json = JSON.parse(response.body);
      expect(json.message).toContain("Device is suspended");
    });
  });
});
