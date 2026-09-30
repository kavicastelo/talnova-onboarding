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

describe("Kiosk Multi-Journey Assignment Engine (K-ASN-001)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;
  let adminAToken: string;
  let adminBToken: string;
  let deviceA: any;
  let deviceAToken: string;
  let journey1: any;
  let journey2: any;
  let journey3: any;
  let journeyOrgB: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up test organizations and users
    await Promise.all([
      Organization.deleteMany({ slug: { $in: ["kiosk-asn-org-a", "kiosk-asn-org-b"] } }),
      User.deleteMany({ "auth.email": { $in: ["kiosk-asn-admin-a@test.com", "kiosk-asn-admin-b@test.com"] } }),
      KioskDeviceModel.deleteMany({ deviceId: { $in: ["kiosk-device-asn-001"] } })
    ]);

    const [orgA, orgB] = await Promise.all([
      Organization.create({
        name: "Assignment Engine Org A",
        slug: "kiosk-asn-org-a",
        status: "Active",
        createdBy: new mongoose.Types.ObjectId(),
        isDeleted: false
      }),
      Organization.create({
        name: "Assignment Engine Org B",
        slug: "kiosk-asn-org-b",
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
        auth: { email: "kiosk-asn-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
        profile: { firstName: "Admin", lastName: "A" },
        permissions: { role: "admin" },
        employment: { status: "active" },
        isDeleted: false
      }),
      User.create({
        organizationId: orgBId,
        auth: { email: "kiosk-asn-admin-b@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
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
    const rawDeviceToken = "kiosk-test-device-raw-jwt-token-asn-001";
    const hashedTokenRef = crypto.createHash("sha256").update(rawDeviceToken).digest("hex");

    deviceA = await KioskDeviceModel.create({
      organizationId: orgAId,
      deviceId: "kiosk-device-asn-001",
      name: "Terminal Gate 04",
      location: "Assembly Plant East Wing",
      status: "online",
      paired: true,
      pairedAt: new Date(),
      tokenRef: hashedTokenRef,
      tokenExpiresAt: new Date(Date.now() + 90 * 86400000),
      isDeleted: false
    });

    deviceAToken = app.jwt.sign({
      role: "kiosk_device",
      deviceId: "kiosk-device-asn-001",
      organizationId: orgAId.toString()
    });

    // Create 3 journeys for Org A
    [journey1, journey2, journey3] = await Promise.all([
      KioskJourneyModel.create({
        organizationId: orgAId,
        title: "General Plant Safety Induction",
        description: "Mandatory general plant safety induction for all personnel",
        steps: [
          {
            id: "step-1",
            title: "Welcome to Plant",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Welcome" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "step-2",
            title: "Safety Conclusion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
          publishedAt: new Date()
        },
        createdBy: adminAUser._id,
        isDeleted: false
      }),
      KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Emergency Evacuation Protocol",
        description: "Site-wide emergency evacuation routes and assembly points",
        steps: [
          {
            id: "step-1",
            title: "Evacuation Plan",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "Evacuation" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "step-2",
            title: "Evacuation Conclusion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
          publishedAt: new Date()
        },
        createdBy: adminAUser._id,
        isDeleted: false
      }),
      KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Hazardous Materials Handling",
        description: "Chemical spill procedures and PPE requirements",
        steps: [
          {
            id: "step-1",
            title: "Hazmat PPE",
            type: "content",
            blocks: [{ id: "b1", type: "text", order: 0, content: { text: "PPE rules" } }],
            order: 0,
            interaction: { type: "tap_to_continue" }
          },
          {
            id: "step-2",
            title: "Hazmat Conclusion",
            type: "completion",
            blocks: [{ id: "b2", type: "text", order: 0, content: { text: "Complete" } }],
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
          publishedAt: new Date()
        },
        createdBy: adminAUser._id,
        isDeleted: false
      })
    ]);

    // Create a journey for Org B to test cross-tenant boundary validation
    journeyOrgB = await KioskJourneyModel.create({
      organizationId: orgBId,
      title: "Org B Journey",
      description: "Should not be assignable to Org A device",
      steps: [
        {
          id: "step-1",
          title: "Org B Step",
          type: "content",
          blocks: [{ id: "b1", type: "text", order: 0, content: { text: "B Content" } }],
          order: 0,
          interaction: { type: "tap_to_continue" }
        },
        {
          id: "step-2",
          title: "Org B Conclusion",
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
        publishedAt: new Date()
      },
      createdBy: adminBUser._id,
      isDeleted: false
    });
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
    // Clean up assignments before each test
    await KioskDeviceAssignmentModel.deleteMany({ organizationId: orgAId });
    await KioskDeviceModel.updateOne(
      { _id: deviceA._id },
      { $unset: { currentJourneyId: 1 } }
    );
  });

  describe("Batch Assignment Creation & Persistence (Acceptance Criteria 1)", () => {
    it("should persist 3 records in KioskDeviceAssignmentModel with correct priorities when admin assigns 3 journeys to Device A", async () => {
      const payload = {
        assignments: [
          { journeyId: journey1._id.toString(), priority: 0, isMandatory: true },
          { journeyId: journey2._id.toString(), priority: 1, isMandatory: false },
          { journeyId: journey3._id.toString(), priority: 2, isMandatory: false }
        ]
      };

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);

      // Verify MongoDB persistence directly in KioskDeviceAssignmentModel
      const persistedAssignments = await KioskDeviceAssignmentModel.find({
        targetId: deviceA._id,
        targetType: "device",
        organizationId: orgAId
      }).sort({ priority: 1 });

      expect(persistedAssignments).toHaveLength(3);

      // Check first assignment
      expect(persistedAssignments[0].journeyId.toString()).toBe(journey1._id.toString());
      expect(persistedAssignments[0].priority).toBe(0);
      expect(persistedAssignments[0].isMandatory).toBe(true);
      expect(persistedAssignments[0].targetType).toBe("device");

      // Check second assignment
      expect(persistedAssignments[1].journeyId.toString()).toBe(journey2._id.toString());
      expect(persistedAssignments[1].priority).toBe(1);
      expect(persistedAssignments[1].isMandatory).toBe(false);

      // Check third assignment
      expect(persistedAssignments[2].journeyId.toString()).toBe(journey3._id.toString());
      expect(persistedAssignments[2].priority).toBe(2);
      expect(persistedAssignments[2].isMandatory).toBe(false);

      // Verify backward compatibility: device.currentJourneyId set to highest priority (journey1)
      const updatedDevice = await KioskDeviceModel.findById(deviceA._id);
      expect(updatedDevice?.currentJourneyId?.toString()).toBe(journey1._id.toString());
    });

    it("should accept assignment via device hardware GUID deviceId string", async () => {
      const payload = {
        assignments: [
          { journeyId: journey2._id.toString(), priority: 0 },
          { journeyId: journey1._id.toString(), priority: 1 }
        ]
      };

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(2);

      const records = await KioskDeviceAssignmentModel.find({ targetId: deviceA._id }).sort({ priority: 1 });
      expect(records).toHaveLength(2);
      expect(records[0].journeyId.toString()).toBe(journey2._id.toString());
    });

    it("should accept raw array format payload", async () => {
      const payload = [
        { journeyId: journey3._id.toString(), priority: 0 },
        { journeyId: journey1._id.toString(), priority: 1 }
      ];

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].journeyId.toString()).toBe(journey3._id.toString());
    });
  });

  describe("Querying Device Assignments (Acceptance Criteria 2)", () => {
    beforeEach(async () => {
      // Seed 3 assignments with distinct priorities
      await KioskDeviceAssignmentModel.create([
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journey3._id,
          priority: 2,
          isMandatory: false,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journey1._id,
          priority: 0,
          isMandatory: true,
          isActive: true,
          assignedBy: adminAUser._id
        },
        {
          organizationId: orgAId,
          targetType: "device",
          targetId: deviceA._id,
          journeyId: journey2._id,
          priority: 1,
          isMandatory: false,
          isActive: true,
          assignedBy: adminAUser._id
        }
      ]);
    });

    it("should return all 3 journeys sorted by priority ascending when queried via GET /devices/:id/assignments", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(3);

      const items = body.data;

      // 1st: journey1 (priority 0)
      expect(items[0].journeyId.toString()).toBe(journey1._id.toString());
      expect(items[0].priority).toBe(0);
      expect(items[0].isMandatory).toBe(true);
      expect(items[0].title).toBe("General Plant Safety Induction");
      expect(items[0].journey).toBeDefined();
      expect(items[0].journey.title).toBe("General Plant Safety Induction");

      // 2nd: journey2 (priority 1)
      expect(items[1].journeyId.toString()).toBe(journey2._id.toString());
      expect(items[1].priority).toBe(1);
      expect(items[1].isMandatory).toBe(false);
      expect(items[1].title).toBe("Emergency Evacuation Protocol");

      // 3rd: journey3 (priority 2)
      expect(items[2].journeyId.toString()).toBe(journey3._id.toString());
      expect(items[2].priority).toBe(2);
      expect(items[2].isMandatory).toBe(false);
      expect(items[2].title).toBe("Hazardous Materials Handling");
    });

    it("should return sorted assignments when queried using hardware GUID", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data).toHaveLength(3);
      expect(body.data[0].journeyId.toString()).toBe(journey1._id.toString());
      expect(body.data[1].journeyId.toString()).toBe(journey2._id.toString());
      expect(body.data[2].journeyId.toString()).toBe(journey3._id.toString());
    });
  });

  describe("Validation & Security Boundaries", () => {
    it("should reject assignment when one or more journey IDs belong to another organization", async () => {
      const payload = {
        assignments: [
          { journeyId: journey1._id.toString(), priority: 0 },
          { journeyId: journeyOrgB._id.toString(), priority: 1 } // belongs to Org B
        ]
      };

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toMatch(/belong to another organization|invalid/i);

      // Verify that no assignments were persisted for Org A
      const count = await KioskDeviceAssignmentModel.countDocuments({ targetId: deviceA._id });
      expect(count).toBe(0);
    });

    it("should reject assignment when journey ID format is invalid", async () => {
      const payload = {
        assignments: [
          { journeyId: "not-a-valid-object-id", priority: 0 }
        ]
      };

      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 404 when target device does not exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${fakeId}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { assignments: [{ journeyId: journey1._id.toString(), priority: 0 }] }
      });

      expect(res.statusCode).toBe(404);
    });

    it("should not allow Admin B to modify assignments on Device A belonging to Org A", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminBToken}` },
        payload: { assignments: [{ journeyId: journeyOrgB._id.toString(), priority: 0 }] }
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("Atomic Synchronization & Reordering", () => {
    it("should atomically replace previous assignments when reordering and updating", async () => {
      // Step 1: Assign journeys 1 and 2
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          assignments: [
            { journeyId: journey1._id.toString(), priority: 0 },
            { journeyId: journey2._id.toString(), priority: 1 }
          ]
        }
      });

      let inDb = await KioskDeviceAssignmentModel.find({ targetId: deviceA._id }).sort({ priority: 1 });
      expect(inDb).toHaveLength(2);
      expect(inDb[0].journeyId.toString()).toBe(journey1._id.toString());

      // Step 2: Update assignments: Replace with journey 3 (priority 0) and journey 1 (priority 1)
      const resUpdate = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          assignments: [
            { journeyId: journey3._id.toString(), priority: 0, isMandatory: true },
            { journeyId: journey1._id.toString(), priority: 1, isMandatory: false }
          ]
        }
      });

      expect(resUpdate.statusCode).toBe(200);

      // Verify that old journey 2 was removed, and new order is persisted
      inDb = await KioskDeviceAssignmentModel.find({ targetId: deviceA._id }).sort({ priority: 1 });
      expect(inDb).toHaveLength(2);
      expect(inDb[0].journeyId.toString()).toBe(journey3._id.toString());
      expect(inDb[0].priority).toBe(0);
      expect(inDb[0].isMandatory).toBe(true);

      expect(inDb[1].journeyId.toString()).toBe(journey1._id.toString());
      expect(inDb[1].priority).toBe(1);

      // Device currentJourneyId fallback updated to journey 3
      const updatedDev = await KioskDeviceModel.findById(deviceA._id);
      expect(updatedDev?.currentJourneyId?.toString()).toBe(journey3._id.toString());
    });

    it("should clear assignments and unset currentJourneyId when empty array is passed", async () => {
      // Seed an assignment first
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { assignments: [{ journeyId: journey1._id.toString(), priority: 0 }] }
      });

      expect(await KioskDeviceAssignmentModel.countDocuments({ targetId: deviceA._id })).toBe(1);

      // Clear assignments
      const resClear = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { assignments: [] }
      });

      expect(resClear.statusCode).toBe(200);
      expect(await KioskDeviceAssignmentModel.countDocuments({ targetId: deviceA._id })).toBe(0);

      const dev = await KioskDeviceModel.findById(deviceA._id);
      expect(dev?.currentJourneyId).toBeUndefined();
    });
  });

  describe("Integration with Manifest and Device Listing", () => {
    it("should return assigned journeys in manifest sorted by assignment priority", async () => {
      // Assign Journey 2 (priority 0) and Journey 1 (priority 1)
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          assignments: [
            { journeyId: journey2._id.toString(), priority: 0 },
            { journeyId: journey1._id.toString(), priority: 1 }
          ]
        }
      });

      const manifestRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/devices/${deviceA.deviceId}/manifest`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(manifestRes.statusCode).toBe(200);
      const manifestJson = JSON.parse(manifestRes.body);
      const manifest = manifestJson.data || manifestJson;
      expect(manifest.journeys).toHaveLength(2);
      // Journey 2 should be first because priority is 0
      expect(manifest.journeys[0]._id.toString()).toBe(journey2._id.toString());
      expect(manifest.journeys[0].title).toBe("Emergency Evacuation Protocol");
      // Journey 1 should be second because priority is 1
      expect(manifest.journeys[1]._id.toString()).toBe(journey1._id.toString());
      expect(manifest.journeys[1].title).toBe("General Plant Safety Induction");
    });

    it("should enrich device listing with active assignments", async () => {
      await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/devices/${deviceA._id}/assignments`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          assignments: [
            { journeyId: journey1._id.toString(), priority: 0 },
            { journeyId: journey3._id.toString(), priority: 1 }
          ]
        }
      });

      const listRes = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices",
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(listRes.statusCode).toBe(200);
      const listData = JSON.parse(listRes.body);
      const targetDev = listData.data.find((d: any) => d._id === deviceA._id.toString());
      expect(targetDev).toBeDefined();
      expect(targetDev.assignments).toHaveLength(2);
      expect(targetDev.assignments[0].journeyId.toString()).toBe(journey1._id.toString());
      expect(targetDev.assignments[1].journeyId.toString()).toBe(journey3._id.toString());
    });
  });
});
