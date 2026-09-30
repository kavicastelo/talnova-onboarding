import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskDeviceModel,
  KioskDeviceAssignmentModel
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

describe("Kiosk Manifest Resolution & Dynamic Fallback Engine (K-ASN-002, ADR-005)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;
  let adminAToken: string;
  let adminBToken: string;
  let deviceA: any;
  let deviceB: any;
  let deviceAToken: string;
  let journeyPublished1: any;
  let journeyPublished2: any;
  let journeyPublished3: any;
  let journeyAutoplay: any;
  let journeyDraft: any;
  let journeyExpired: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test organizations and users
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["kiosk-mnf-org-a", "kiosk-mnf-org-b"] } }),
      User.deleteMany({ "auth.email": { $in: ["kiosk-mnf-admin-a@test.com", "kiosk-mnf-admin-b@test.com"] } }),
      KioskDeviceModel.deleteMany({ deviceId: { $in: ["kiosk-device-mnf-001", "kiosk-device-mnf-002"] } })
    ]);

    const [orgA, orgB] = await Promise.all([
      Organization.create({
        name: "Manifest Org A",
        slug: "kiosk-mnf-org-a",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      }),
      Organization.create({
        name: "Manifest Org B",
        slug: "kiosk-mnf-org-b",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      })
    ]);
    orgAId = orgA._id as mongoose.Types.ObjectId;
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Seed admin users
    const [adminA, adminB] = await Promise.all([
      User.create({
        organizationId: orgAId,
        auth: { email: "kiosk-mnf-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Admin", lastName: "A" },
        permissions: { role: "admin" },
        employment: { status: "active" },
        isDeleted: false
      }),
      User.create({
        organizationId: orgBId,
        auth: { email: "kiosk-mnf-admin-b@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
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

    // Create paired physical terminals
    const rawToken = "kiosk-test-device-raw-jwt-token-mnf-001";
    const hashedTokenRef = crypto.createHash("sha256").update(rawToken).digest("hex");

    deviceA = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-mnf-001",
      name: "Terminal Shop Floor North",
      location: "Fabrication Unit 1",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: hashedTokenRef,
      tokenExpiresAt: new Date(Date.now() + 90 * 86400000),
      isDeleted: false
    });

    deviceB = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-mnf-002",
      name: "Terminal Fresh Out-of-Box",
      location: "Shipping Bay 3",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: hashedTokenRef,
      tokenExpiresAt: new Date(Date.now() + 90 * 86400000),
      isDeleted: false
    });

    deviceAToken = app.jwt.sign({
      role: "kiosk_device",
      deviceId: "kiosk-device-mnf-001",
      organizationId: orgAId.toString()
    });

    // Create published journeys
    [journeyPublished1, journeyPublished2, journeyPublished3, journeyAutoplay, journeyDraft, journeyExpired] =
      await Promise.all([
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "Safety Standard Induction",
          description: "General plant safety rules",
          steps: [
            {
              id: "s1",
              title: "Safety Step",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Safety First" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "Safety Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: defaultSettings,
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: { status: "published", version: 1, publishedAt: new Date() },
          createdBy: adminAUser._id,
          isDeleted: false
        }),
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "Emergency Evacuation Drill",
          description: "Assembly area map",
          steps: [
            {
              id: "s1",
              title: "Evac Step",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Evacuation Route" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "Evac Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: defaultSettings,
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: { status: "published", version: 1, publishedAt: new Date() },
          createdBy: adminAUser._id,
          isDeleted: false
        }),
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "PPE Gear Checklist",
          description: "Mandatory PPE inspection",
          steps: [
            {
              id: "s1",
              title: "PPE Step",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Helmets & Boots" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "PPE Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: defaultSettings,
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: { status: "published", version: 1, publishedAt: new Date() },
          createdBy: adminAUser._id,
          isDeleted: false
        }),
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "Continuous Visitor Welcome Loop",
          description: "Autoplay looping safety video",
          steps: [
            {
              id: "s1",
              title: "Video Welcome",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Welcome visitors" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "Video Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: { ...defaultSettings, autoPlay: true, loopForever: true },
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: { status: "published", version: 1, publishedAt: new Date() },
          createdBy: adminAUser._id,
          isDeleted: false
        }),
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "Draft Unfinished Protocol",
          description: "Not yet approved",
          steps: [
            {
              id: "s1",
              title: "Draft Step",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Drafting" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "Draft Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: defaultSettings,
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: { status: "draft", version: 1 },
          createdBy: adminAUser._id,
          isDeleted: false
        }),
        KioskJourneyModel.create({
          organizationId: orgAId,
          title: "Expired 2025 Safety Rules",
          description: "Outdated OSHA guidelines",
          steps: [
            {
              id: "s1",
              title: "Expired Step",
              type: "content",
              blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Old rule" } }],
              order: 0,
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "s2",
              title: "Expired Done",
              type: "completion",
              blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Done" } }],
              order: 1,
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: defaultSettings,
          supportedLanguages: ["en"],
          defaultLanguage: "en",
          publishing: {
            status: "published",
            version: 1,
            publishedAt: new Date("2025-01-01"),
            scheduling: {
              expiresAt: new Date("2025-12-31")
            }
          },
          createdBy: adminAUser._id,
          isDeleted: false
        })
      ]);
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } }),
      adminAUser && adminBUser ? User.deleteMany({ _id: { $in: [adminAUser._id, adminBUser._id] } }) : Promise.resolve(),
      KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } })
    ]);

    await app.close();
    await disconnectDatabase(app.log);
  }, 60000);

  beforeEach(async () => {
    await KioskDeviceAssignmentModel.deleteMany({ organizationId: orgAId });
    await KioskDeviceModel.updateOne(
      { _id: deviceA._id },
      { $unset: { currentJourneyId: 1, deviceGroupId: 1, siteId: 1 } }
    );
    await KioskDeviceModel.updateOne(
      { _id: deviceB._id },
      { $unset: { currentJourneyId: 1, deviceGroupId: 1, siteId: 1 } }
    );
  });

  describe("Explicit Active Assignments (Acceptance Criterion 1)", () => {
    it("should return exactly those 2 assigned journeys with launchMode 'launcher' when 2 explicit active assignments exist", async () => {
      // Assign journeyPublished1 (priority 0) and journeyPublished2 (priority 1)
      await KioskDeviceAssignmentModel.create([
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journeyPublished1._id,
          priority: 0,
          isMandatory: true,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journeyPublished2._id,
          priority: 1,
          isMandatory: false,
          isActive: true,
          assignedBy: adminAUser._id
        }
      ]);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const manifest = body.data || body;

      expect(manifest.launchMode).toBe("launcher");
      expect(manifest.journeys).toHaveLength(2);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
      expect(manifest.journeys[0].priority).toBe(0);
      expect(manifest.journeys[0].isMandatory).toBe(true);

      expect(manifest.journeys[1]._id.toString()).toBe(journeyPublished2._id.toString());
      expect(manifest.journeys[1].priority).toBe(1);
      expect(manifest.journeys[1].isMandatory).toBe(false);

      expect(manifest.device).toBeDefined();
      expect(manifest.device.deviceId).toBe(deviceA.deviceId);
      expect(manifest.settings).toBeDefined();
    });
  });

  describe("Dynamic Fallback Rule (Acceptance Criterion 2)", () => {
    it("should fall back to all published organization journeys when a device has zero explicit assignments", async () => {
      // Device B has zero explicit assignments
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceB.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const manifest = body.data || body;

      expect(manifest.launchMode).toBe("launcher");

      // The 4 published, non-expired journeys (journeyPublished1, journeyPublished2, journeyPublished3, journeyAutoplay)
      // Draft and Expired must be excluded!
      expect(manifest.journeys).toHaveLength(4);
      const returnedIds = manifest.journeys.map((j: any) => j._id.toString());

      expect(returnedIds).toContain(journeyPublished1._id.toString());
      expect(returnedIds).toContain(journeyPublished2._id.toString());
      expect(returnedIds).toContain(journeyPublished3._id.toString());
      expect(returnedIds).toContain(journeyAutoplay._id.toString());

      // Ensure draft and expired are NOT included
      expect(returnedIds).not.toContain(journeyDraft._id.toString());
      expect(returnedIds).not.toContain(journeyExpired._id.toString());
    });
  });

  describe("Autoplay Single-Journey Semantics (Acceptance Criterion 3)", () => {
    it("should return launchMode 'autoplay' with that single journey when a device has exactly 1 assignment and autoPlay is true", async () => {
      // Assign journeyAutoplay (which has settings.autoPlay === true)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: journeyAutoplay._id,
        priority: 0,
        isMandatory: false,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const manifest = body.data || body;

      expect(manifest.launchMode).toBe("autoplay");
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyAutoplay._id.toString());
      expect(manifest.settings.autoPlay).toBe(true);
    });

    it("should return launchMode 'launcher' when a device has exactly 1 assignment but autoPlay is false", async () => {
      // Assign journeyPublished1 (which has settings.autoPlay === false)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: journeyPublished1._id,
        priority: 0,
        isMandatory: false,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const manifest = body.data || body;

      expect(manifest.launchMode).toBe("launcher");
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
    });

    it("should return launchMode 'launcher' when a device has multiple assignments even if one has autoPlay true", async () => {
      // Assign journeyAutoplay and journeyPublished1
      await KioskDeviceAssignmentModel.create([
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journeyAutoplay._id,
          priority: 0,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journeyPublished1._id,
          priority: 1,
          isActive: true,
          assignedBy: adminAUser._id
        }
      ]);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const manifest = body.data || body;

      // With multiple journeys, launcher mode must be rendered so worker can choose
      expect(manifest.launchMode).toBe("launcher");
      expect(manifest.journeys).toHaveLength(2);
    });
  });

  describe("Device Group & Site Inheritance", () => {
    it("should resolve journeys assigned to device group", async () => {
      const groupId = new mongoose.Types.ObjectId();
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { deviceGroupId: groupId.toString() } }
      );

      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: groupId,
        journeyId: journeyPublished2._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const manifest = JSON.parse(res.body).data;
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished2._id.toString());
    });

    it("should resolve journeys assigned to site", async () => {
      const siteId = new mongoose.Types.ObjectId();
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { siteId: siteId.toString() } }
      );

      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "site",
        targetId: siteId,
        journeyId: journeyPublished3._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const manifest = JSON.parse(res.body).data;
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished3._id.toString());
    });

    it("should prioritize direct device assignments over device group and site assignments", async () => {
      const groupId = new mongoose.Types.ObjectId();
      const siteId = new mongoose.Types.ObjectId();
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { deviceGroupId: groupId.toString(), siteId: siteId.toString() } }
      );

      await KioskDeviceAssignmentModel.create([
        {
          organizationId: orgAId,
          targetType: "site",
          targetId: siteId,
          journeyId: journeyPublished3._id,
          priority: 0,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device_group",
          targetId: groupId,
          journeyId: journeyPublished2._id,
          priority: 0,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journeyPublished1._id,
          priority: 0,
          isActive: true,
          assignedBy: adminAUser._id
        }
      ]);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const manifest = JSON.parse(res.body).data;
      expect(manifest.journeys).toHaveLength(3);
      // Direct device assignment ranks 1st
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
      // Group assignment ranks 2nd
      expect(manifest.journeys[1]._id.toString()).toBe(journeyPublished2._id.toString());
      // Site assignment ranks 3rd
      expect(manifest.journeys[2]._id.toString()).toBe(journeyPublished3._id.toString());
    });
  });

  describe("Scheduling Window Rules Filtering", () => {
    it("should filter out assignment outside of time-of-day UTC window", async () => {
      // Assignment valid only between 08:00 and 12:00 UTC
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: journeyPublished1._id,
        priority: 0,
        isActive: true,
        scheduling: {
          enabled: true,
          startTimeUtc: "08:00",
          endTimeUtc: "12:00"
        },
        assignedBy: adminAUser._id
      });

      // Query with simulated time outside window (15:00 UTC)
      const resOutside = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest?now=2026-06-01T15:00:00Z`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(resOutside.statusCode).toBe(200);
      const manifestOutside = JSON.parse(resOutside.body).data;
      expect(manifestOutside.journeys).toHaveLength(0);

      // Query with simulated time inside window (10:00 UTC)
      const resInside = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest?now=2026-06-01T10:00:00Z`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(resInside.statusCode).toBe(200);
      const manifestInside = JSON.parse(resInside.body).data;
      expect(manifestInside.journeys).toHaveLength(1);
      expect(manifestInside.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
    });

    it("should filter out assignment outside of day-of-week constraint", async () => {
      // Assignment valid only on Mondays (1) and Tuesdays (2)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: journeyPublished2._id,
        priority: 0,
        isActive: true,
        scheduling: {
          enabled: true,
          daysOfWeek: [1, 2]
        },
        assignedBy: adminAUser._id
      });

      // 2026-06-07 is Sunday (day 0)
      const resSunday = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest?now=2026-06-07T10:00:00Z`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      const manifestSunday = JSON.parse(resSunday.body).data;
      expect(manifestSunday.journeys).toHaveLength(0);

      // 2026-06-08 is Monday (day 1)
      const resMonday = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest?now=2026-06-08T10:00:00Z`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      const manifestMonday = JSON.parse(resMonday.body).data;
      expect(manifestMonday.journeys).toHaveLength(1);
      expect(manifestMonday.journeys[0]._id.toString()).toBe(journeyPublished2._id.toString());
    });
  });

  describe("Security & Device Restrictions", () => {
    it("should deny manifest access (403) to suspended device", async () => {
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { status: "suspended" } }
      );

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("should deny manifest access (403) to decommissioned device", async () => {
      await KioskDeviceModel.updateOne(
        { _id: deviceA._id },
        { $set: { status: "decommissioned" } }
      );

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(403);
    });

    it("should return 404 when querying device belonging to another organization", async () => {
      // Admin B requests manifest for Device A (Org A)
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
