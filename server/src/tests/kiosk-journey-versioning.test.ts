import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskJourneyVersionModel,
  computeCanonicalStepsChecksum,
  canonicalizeJson
} from "../modules/kiosk/index.js";

describe("Kiosk Journey Immutable Version Snapshot Pipeline (K-JRN-001 / DEF-006)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;
  let adminAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up any stale organizations first
    await Organization.deleteMany({ slug: { $in: ["kiosk-ver-org-a", "kiosk-ver-org-b"] } });

    const orgA = await Organization.create({
      name: "Kiosk Versioning Org A",
      slug: "kiosk-ver-org-a",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Kiosk Versioning Org B",
      slug: "kiosk-ver-org-b",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Clean up old test data
    await User.deleteMany({
      "auth.email": { $in: ["kiosk-ver-admin-a@test.com", "kiosk-ver-admin-b@test.com"] }
    });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskJourneyVersionModel.collection.deleteMany({
      organizationId: { $in: [orgAId, orgBId] }
    });

    // Seed admin users
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: { email: "kiosk-ver-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminBUser = await User.create({
      organizationId: orgBId,
      auth: { email: "kiosk-ver-admin-b@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
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
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ _id: { $in: [adminAUser._id, adminBUser._id] } });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskJourneyVersionModel.collection.deleteMany({
      organizationId: { $in: [orgAId, orgBId] }
    });

    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Canonical Checksum Determinism", () => {
    it("should compute identical checksum for steps regardless of object key order", () => {
      const stepsA = [
        {
          id: "step-1",
          type: "instruction_step",
          title: "Introduction",
          order: 0,
          interaction: { type: "tap_to_continue" }
        }
      ];

      const stepsB = [
        {
          order: 0,
          title: "Introduction",
          interaction: { type: "tap_to_continue" },
          id: "step-1",
          type: "instruction_step"
        }
      ];

      const hashA = computeCanonicalStepsChecksum(stepsA);
      const hashB = computeCanonicalStepsChecksum(stepsB);

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64);
    });

    it("should compute different checksums when step content changes", () => {
      const stepsA = [
        {
          id: "step-1",
          type: "instruction_step",
          title: "Introduction",
          order: 0,
          interaction: { type: "tap_to_continue" }
        }
      ];

      const stepsB = [
        {
          id: "step-1",
          type: "instruction_step",
          title: "Introduction - Updated Safety Warning",
          order: 0,
          interaction: { type: "tap_to_continue" }
        }
      ];

      const hashA = computeCanonicalStepsChecksum(stepsA);
      const hashB = computeCanonicalStepsChecksum(stepsB);

      expect(hashA).not.toBe(hashB);
    });
  });

  describe("Journey Publishing & Immutable Snapshot Pipeline", () => {
    let journeyId: string;
    let initialVersionChecksum: string;

    it("should publish a draft journey and create an immutable version 1 snapshot", async () => {
      // 1. Create a draft journey
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/journeys",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Warehouse Safety Induction v1",
          description: "Initial safety compliance curriculum",
          languages: ["en", "es"],
          steps: [
            {
              id: "step-intro",
              type: "instruction_step",
              title: "Welcome to Warehouse Safety",
              order: 0,
              blocks: [],
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "step-ppe",
              type: "interactive_confirmation",
              title: "Required PPE Inspection",
              order: 1,
              blocks: [],
              interaction: {
                type: "ppe_checklist",
                ppeItems: ["hard_hat", "safety_glasses", "steel_toe_boots"]
              }
            },
            {
              id: "step-complete",
              type: "completion",
              title: "Safety Induction Complete",
              order: 2,
              blocks: [],
              interaction: { type: "tap_to_continue" }
            }
          ],
          settings: {
            autoPlay: false,
            loopForever: false,
            idleTimeoutSeconds: 90,
            autoReturnHome: true,
            hideNavigation: false,
            disableExit: true,
            security: { protectionType: "none" }
          },
          publishing: {
            status: "draft",
            version: 1
          }
        }
      });

      expect(createRes.statusCode).toBe(201);
      const createdData = JSON.parse(createRes.payload).data;
      journeyId = createdData._id;
      expect(createdData.publishing.status).toBe("draft");
      expect(createdData.publishing.version).toBe(1);

      // 2. Publish journey
      const publishRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyId}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { changelog: "Initial production release" }
      });

      expect(publishRes.statusCode).toBe(200);
      const publishedDraft = JSON.parse(publishRes.payload).data;
      expect(publishedDraft.publishing.status).toBe("published");
      expect(publishedDraft.publishing.version).toBe(1);

      // 3. Verify snapshot was inserted into KioskJourneyVersionModel
      const snapshot = await KioskJourneyVersionModel.findOne({
        journeyId: new mongoose.Types.ObjectId(journeyId),
        version: 1
      });

      expect(snapshot).not.toBeNull();
      expect(snapshot?.title).toBe("Warehouse Safety Induction v1");
      expect(snapshot?.version).toBe(1);
      expect(snapshot?.status).toBe("published");
      expect(snapshot?.changelog).toBe("Initial production release");
      expect(snapshot?.steps).toHaveLength(3);
      expect(snapshot?.steps[1].interaction.ppeItems).toEqual([
        "hard_hat",
        "safety_glasses",
        "steel_toe_boots"
      ]);
      expect(snapshot?.contentChecksum).toHaveLength(64);
      initialVersionChecksum = snapshot!.contentChecksum;
    });

    it("DEF-006: should guarantee that draft edits do not mutate the previously published snapshot", async () => {
      // 1. Admin edits the draft journey in KioskBuilder
      const updateRes = await app.inject({
        method: "PUT",
        url: `/api/v1/kiosk/journeys/${journeyId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Warehouse Safety Induction - DRAFT EDIT IN PROGRESS",
          description: "Mutated description while revising",
          languages: ["en"],
          steps: [
            {
              id: "step-intro-modified",
              type: "instruction_step",
              title: "Brand New Welcome Slide",
              order: 0,
              blocks: [],
              interaction: { type: "tap_to_continue" }
            },
            {
              id: "step-complete-modified",
              type: "completion",
              title: "Induction Wrap Up",
              order: 1,
              blocks: [],
              interaction: { type: "tap_to_continue" }
            }
          ]
        }
      });

      expect(updateRes.statusCode).toBe(200);

      // Verify draft in KioskJourneyModel was updated
      const draftDoc = await KioskJourneyModel.findById(journeyId);
      expect(draftDoc?.title).toBe("Warehouse Safety Induction - DRAFT EDIT IN PROGRESS");
      expect(draftDoc?.steps).toHaveLength(2);

      // CRITICAL DEF-006 ASSERTION:
      // The version 1 snapshot in KioskJourneyVersionModel MUST REMAIN COMPLETELY UNTOUCHED!
      const version1Snapshot = await KioskJourneyVersionModel.findOne({
        journeyId: new mongoose.Types.ObjectId(journeyId),
        version: 1
      });

      expect(version1Snapshot).not.toBeNull();
      expect(version1Snapshot?.title).toBe("Warehouse Safety Induction v1");
      expect(version1Snapshot?.description).toBe("Initial safety compliance curriculum");
      expect(version1Snapshot?.languages).toEqual(["en", "es"]);
      expect(version1Snapshot?.steps).toHaveLength(3);
      expect(version1Snapshot?.steps[0].title).toBe("Welcome to Warehouse Safety");
      expect(version1Snapshot?.contentChecksum).toBe(initialVersionChecksum);
    });

    it("should publish a new version 2 snapshot with incremented version and new checksum", async () => {
      const publishRes = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyId}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { changelog: "Revamped curriculum with condensed single module" }
      });

      expect(publishRes.statusCode).toBe(200);
      const publishedDraft = JSON.parse(publishRes.payload).data;
      expect(publishedDraft.publishing.version).toBe(2);

      // Verify both version 1 and version 2 snapshots exist
      const allVersions = await KioskJourneyVersionModel.find({
        journeyId: new mongoose.Types.ObjectId(journeyId)
      }).sort({ version: 1 });

      expect(allVersions).toHaveLength(2);

      const v1 = allVersions[0];
      const v2 = allVersions[1];

      expect(v1.version).toBe(1);
      expect(v1.title).toBe("Warehouse Safety Induction v1");
      expect(v1.steps).toHaveLength(3);

      expect(v2.version).toBe(2);
      expect(v2.title).toBe("Warehouse Safety Induction - DRAFT EDIT IN PROGRESS");
      expect(v2.steps).toHaveLength(2);
      expect(v2.changelog).toBe("Revamped curriculum with condensed single module");
      expect(v2.contentChecksum).not.toBe(v1.contentChecksum);
    });
  });

  describe("Strict Database-Level Immutability Enforcement", () => {
    let testVersionDoc: any;

    beforeAll(async () => {
      testVersionDoc = await KioskJourneyVersionModel.findOne({
        organizationId: orgAId,
        version: 1
      });
      expect(testVersionDoc).not.toBeNull();
    });

    it("should reject document.save() modification with IMMUTABLE_VERSION error", async () => {
      testVersionDoc.title = "Attempted Hack Title";
      await expect(testVersionDoc.save()).rejects.toThrow(/IMMUTABLE_VERSION/);
    });

    it("should reject Model.updateOne with IMMUTABLE_VERSION error", async () => {
      await expect(
        KioskJourneyVersionModel.updateOne(
          { _id: testVersionDoc._id },
          { $set: { title: "Attempted Hack Update" } }
        )
      ).rejects.toThrow(/IMMUTABLE_VERSION/);
    });

    it("should reject Model.findOneAndUpdate with IMMUTABLE_VERSION error", async () => {
      await expect(
        KioskJourneyVersionModel.findOneAndUpdate(
          { _id: testVersionDoc._id },
          { $set: { title: "Attempted Hack FindOneAndUpdate" } }
        )
      ).rejects.toThrow(/IMMUTABLE_VERSION/);
    });

    it("should reject document.deleteOne() with IMMUTABLE_VERSION error", async () => {
      await expect(testVersionDoc.deleteOne()).rejects.toThrow(/IMMUTABLE_VERSION/);
    });

    it("should reject Model.deleteOne with IMMUTABLE_VERSION error", async () => {
      await expect(
        KioskJourneyVersionModel.deleteOne({ _id: testVersionDoc._id })
      ).rejects.toThrow(/IMMUTABLE_VERSION/);
    });

    it("should reject Model.findOneAndDelete with IMMUTABLE_VERSION error", async () => {
      await expect(
        KioskJourneyVersionModel.findOneAndDelete({ _id: testVersionDoc._id })
      ).rejects.toThrow(/IMMUTABLE_VERSION/);
    });
  });

  describe("Version History Inspection & HTTP Mutation Rejection", () => {
    let publishedJourney: any;

    beforeAll(async () => {
      publishedJourney = await KioskJourneyModel.findOne({ organizationId: orgAId });
      expect(publishedJourney).not.toBeNull();
    });

    it("GET /api/v1/kiosk/journeys/:id/versions - should list all versions descending", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].version).toBe(2);
      expect(body.data[1].version).toBe(1);
    });

    it("GET /api/v1/kiosk/journeys/:id/versions/:version - should retrieve specific version snapshot", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/1`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.data.version).toBe(1);
      expect(body.data.title).toBe("Warehouse Safety Induction v1");
    });

    it("GET /api/v1/kiosk/journeys/:id/versions/:version - should return 404 for non-existent version", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/999`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(404);
    });

    it("GET /api/v1/kiosk/journeys/:id/versions/:version - should reject invalid version format", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/abc`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(400);
    });

    it("PUT /api/v1/kiosk/journeys/:id/versions/:version - should reject HTTP update attempt as prohibited", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/1`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { title: "Illegal Edit" }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("IMMUTABLE_VERSION");
    });

    it("DELETE /api/v1/kiosk/journeys/:id/versions/:version - should reject HTTP delete attempt as prohibited", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/1`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe("IMMUTABLE_VERSION");
    });

    it("should prevent tenant crossover when accessing version snapshots", async () => {
      // Admin B tries to list versions of Org A's journey
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });

      expect(listRes.statusCode).toBe(404);

      // Admin B tries to retrieve specific version of Org A's journey
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}/versions/1`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });

      expect(getRes.statusCode).toBe(404);
    });
  });
});
