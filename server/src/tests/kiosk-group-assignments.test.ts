import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskDeviceModel,
  KioskDeviceAssignmentModel,
  KioskDeviceGroupModel
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

describe("Kiosk Device Groups & Site Hierarchy Inheritance (K-ASN-003)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;
  let adminAToken: string;
  let adminBToken: string;
  let deviceA: any;
  let deviceB: any;
  let journeyPublished1: any;
  let journeyPublished2: any;
  let journeyPublished3: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    orgAId = new mongoose.Types.ObjectId();
    orgBId = new mongoose.Types.ObjectId();

    await Organization.create([
      {
        _id: orgAId,
        name: "Acme Logistics Global",
        slug: `acme-logistics-${Date.now()}`,
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      },
      {
        _id: orgBId,
        name: "Competitor Logistics Inc",
        slug: `comp-logistics-${Date.now()}`,
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      }
    ]);

    adminAUser = await User.create({
      organizationId: orgAId,
      auth: { email: `admin-a-${Date.now()}@acme.com`, passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminBUser = await User.create({
      organizationId: orgBId,
      auth: { email: `admin-b-${Date.now()}@competitor.com`, passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Admin", lastName: "B" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

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

    deviceA = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-grp-001",
      hardwareGuid: "kiosk-device-grp-001",
      name: "Warehouse Gate Terminal 1",
      location: "Building 4 Dock A",
      status: "online",
      paired: true,
      currentContentVersion: 1,
      lastSeen: new Date()
    });

    deviceB = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-grp-002",
      hardwareGuid: "kiosk-device-grp-002",
      name: "Warehouse Gate Terminal 2",
      location: "Building 4 Dock B",
      status: "online",
      paired: true,
      currentContentVersion: 1,
      lastSeen: new Date()
    });

    [journeyPublished1, journeyPublished2, journeyPublished3] = await Promise.all([
      KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Standard Facility Safety Induction",
        description: "General orientation",
        steps: [
          {
            id: "s1",
            title: "Facility Rules",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Facility guidelines" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "s2",
            title: "Completion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
        title: "Logistics Heavy Equipment Protocol",
        description: "Forklift and dock rules",
        steps: [
          {
            id: "s1",
            title: "Equipment Rules",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Forklift safety" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "s2",
            title: "Completion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
        title: "Campus-Wide Emergency Evacuation",
        description: "Fire and severe weather",
        steps: [
          {
            id: "s1",
            title: "Evacuation Plan",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Exits" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "s2",
            title: "Completion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
      })
    ]);
  }, 60000);

  afterAll(async () => {
    await Promise.all([
      Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } }),
      adminAUser && adminBUser ? User.deleteMany({ _id: { $in: [adminAUser._id, adminBUser._id] } }) : Promise.resolve(),
      KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } }),
      KioskDeviceGroupModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } })
    ]);

    await app.close();
    await disconnectDatabase(app.log);
  }, 60000);

  beforeEach(async () => {
    await KioskDeviceAssignmentModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskDeviceGroupModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskDeviceModel.updateMany(
      { _id: { $in: [deviceA._id, deviceB._id] } },
      { $unset: { currentJourneyId: 1, deviceGroupId: 1, siteId: 1 } }
    );
  });

  describe("Administrative Device Group Management Endpoints", () => {
    it("should create a new device group with member devices", async () => {
      const siteId = new mongoose.Types.ObjectId().toString();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/groups",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: "Logistics Group",
          description: "All dockside and forklift check-in terminals",
          siteId,
          deviceIds: [deviceA._id.toString(), deviceB._id.toString()]
        }
      });

      expect(res.statusCode).toBe(201);
      const group = JSON.parse(res.body).data;
      expect(group.name).toBe("Logistics Group");
      expect(group.description).toBe("All dockside and forklift check-in terminals");
      expect(group.siteId.toString()).toBe(siteId);
      expect(group.deviceIds).toHaveLength(2);
      expect(group.deviceIds[0].toString()).toBe(deviceA._id.toString());
    });

    it("should reject creation without a group name", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/groups",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: "",
          description: "No name"
        }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toMatch(/name is required/i);
    });

    it("should reject creation with device IDs belonging to another organization", async () => {
      // Create a foreign device belonging to Org B
      const foreignDevice = await KioskDeviceModel.create({
        organizationId: orgBId,
        deviceId: "kiosk-foreign-001",
        hardwareGuid: "kiosk-foreign-001",
        name: "Competitor Device",
        location: "Competitor Dock",
        status: "online",
        paired: true
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/groups",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: "Illicit Cross-Org Group",
          deviceIds: [foreignDevice._id.toString()]
        }
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).message).toMatch(/belong to another organization/i);
    });

    it("should list device groups with enriched deviceCount and assignmentCount", async () => {
      const created = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "North Campus Terminals",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: created._id,
        journeyId: journeyPublished1._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/groups",
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const groups = JSON.parse(res.body).data;
      expect(groups).toHaveLength(1);
      expect(groups[0].name).toBe("North Campus Terminals");
      expect(groups[0].deviceCount).toBe(1);
      expect(groups[0].assignmentCount).toBe(1);
    });

    it("should retrieve a single device group by ID with member devices and assignments", async () => {
      const created = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Security Gate Terminals",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/groups/${created._id}`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const group = JSON.parse(res.body).data;
      expect(group.name).toBe("Security Gate Terminals");
      expect(group.devices).toHaveLength(1);
      expect(group.devices[0].name).toBe("Warehouse Gate Terminal 1");
    });

    it("should update a device group name, description, and membership", async () => {
      const created = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Old Group Name",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/kiosk/groups/${created._id}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: "Updated Logistics Fleet",
          description: "Added Terminal 2",
          deviceIds: [deviceA._id.toString(), deviceB._id.toString()]
        }
      });

      expect(res.statusCode).toBe(200);
      const updated = JSON.parse(res.body).data;
      expect(updated.name).toBe("Updated Logistics Fleet");
      expect(updated.description).toBe("Added Terminal 2");
      expect(updated.deviceIds).toHaveLength(2);
    });

    it("should soft delete a device group and clear its assignments", async () => {
      const created = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Temporary Group",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: created._id,
        journeyId: journeyPublished1._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/kiosk/groups/${created._id}`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);

      // Verify soft delete
      const inDb = await KioskDeviceGroupModel.findById(created._id);
      expect(inDb?.isDeleted).toBe(true);

      // Verify assignments cleared
      const assignments = await KioskDeviceAssignmentModel.find({
        targetType: "device_group",
        targetId: created._id
      });
      expect(assignments).toHaveLength(0);
    });
  });

  describe("Device Group Assignments API", () => {
    it("should batch update and query assignments for a device group", async () => {
      const group = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Maintenance Group",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      const postRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/groups/${group._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          assignments: [
            { journeyId: journeyPublished2._id.toString(), priority: 0, isMandatory: true },
            { journeyId: journeyPublished1._id.toString(), priority: 1, isMandatory: false }
          ]
        }
      });

      expect(postRes.statusCode).toBe(200);
      const saved = JSON.parse(postRes.body).data;
      expect(saved).toHaveLength(2);
      expect(saved[0].journeyId.toString()).toBe(journeyPublished2._id.toString());
      expect(saved[0].isMandatory).toBe(true);
      expect(saved[1].journeyId.toString()).toBe(journeyPublished1._id.toString());

      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/groups/${group._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(getRes.statusCode).toBe(200);
      const retrieved = JSON.parse(getRes.body).data;
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].journeyTitle).toBe("Logistics Heavy Equipment Protocol");
    });
  });

  describe("Acceptance Criteria & Manifest Resolution Inheritance", () => {
    it("Acceptance Criterion: Given Device A belonging to 'Logistics Group', When a journey is assigned to 'Logistics Group', Then Device A's manifest includes that journey via inheritance", async () => {
      // Create Logistics Group containing Device A
      const group = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Logistics Group",
        description: "Terminals on the logistics dock",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      // Assign journeyPublished2 to "Logistics Group"
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: group._id,
        journeyId: journeyPublished2._id,
        priority: 0,
        isMandatory: true,
        isActive: true,
        assignedBy: adminAUser._id
      });

      // Query Device A's manifest
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const manifest = JSON.parse(res.body).data;
      // Inherits the single journey from the group
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished2._id.toString());
      expect(manifest.journeys[0].title).toBe("Logistics Heavy Equipment Protocol");
      expect(manifest.journeys[0].isMandatory).toBe(true);
    });

    it("should allow all member devices in a group to inherit the assigned journey", async () => {
      // Group with both Device A and Device B
      const group = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Warehouse Full Fleet",
        deviceIds: [deviceA._id, deviceB._id],
        isDeleted: false
      });

      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: group._id,
        journeyId: journeyPublished1._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      // Device A manifest
      const resA = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      const manifestA = JSON.parse(resA.body).data;
      expect(manifestA.journeys).toHaveLength(1);
      expect(manifestA.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());

      // Device B manifest
      const resB = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceB.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });
      const manifestB = JSON.parse(resB.body).data;
      expect(manifestB.journeys).toHaveLength(1);
      expect(manifestB.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
    });

    it("should inherit site assignments when siteId is associated with the device's group", async () => {
      const siteId = new mongoose.Types.ObjectId();

      // Device Group associated with siteId
      const group = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "North Campus Zone",
        siteId: siteId.toString(),
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      // Assign journey to site
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "site",
        targetId: siteId,
        journeyId: journeyPublished3._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      // Manifest request for Device A
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const manifest = JSON.parse(res.body).data;
      expect(manifest.journeys).toHaveLength(1);
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished3._id.toString());
      expect(manifest.journeys[0].title).toBe("Campus-Wide Emergency Evacuation");
    });

    it("should properly order assignments: direct device > group > site", async () => {
      const siteId = new mongoose.Types.ObjectId();

      const group = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Zone 1 Group",
        siteId: siteId.toString(),
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      // 1. Site Assignment: journeyPublished3 (priority 0 -> rank 200)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "site",
        targetId: siteId,
        journeyId: journeyPublished3._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      // 2. Group Assignment: journeyPublished2 (priority 0 -> rank 100)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device_group",
        targetId: group._id,
        journeyId: journeyPublished2._id,
        priority: 0,
        isActive: true,
        assignedBy: adminAUser._id
      });

      // 3. Direct Device Assignment: journeyPublished1 (priority 0 -> rank 0)
      await KioskDeviceAssignmentModel.create({
        organizationId: orgAId,
        targetType: "device",
        targetId: deviceA._id,
        journeyId: journeyPublished1._id,
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
      expect(manifest.journeys).toHaveLength(3);
      // Hierarchy verification: device (1st), group (2nd), site (3rd)
      expect(manifest.journeys[0]._id.toString()).toBe(journeyPublished1._id.toString());
      expect(manifest.journeys[1]._id.toString()).toBe(journeyPublished2._id.toString());
      expect(manifest.journeys[2]._id.toString()).toBe(journeyPublished3._id.toString());
    });
  });

  describe("Tenant Isolation", () => {
    it("should prevent Admin B from accessing or updating Org A's groups", async () => {
      const groupA = await KioskDeviceGroupModel.create({
        organizationId: orgAId,
        name: "Confidential Org A Group",
        deviceIds: [deviceA._id],
        isDeleted: false
      });

      // Admin B tries to get Group A
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/groups/${groupA._id}`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });
      expect(getRes.statusCode).toBe(404);

      // Admin B tries to update Group A
      const putRes = await app.inject({
        method: "PUT",
        url: `/api/v1/kiosk/groups/${groupA._id}`,
        headers: { authorization: `Bearer ${adminBToken}` },
        payload: { name: "Hacked Group" }
      });
      expect(putRes.statusCode).toBe(404);

      // Admin B tries to delete Group A
      const delRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/kiosk/groups/${groupA._id}`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });
      expect(delRes.statusCode).toBe(404);
    });
  });
});
