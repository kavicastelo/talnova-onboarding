import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import config from "../config/index.js";
import {
  KioskJourneyModel,
  KioskDeviceModel,
  KioskAnalyticsModel,
  KioskSecurityService,
  CreateKioskJourneySchema
} from "../modules/kiosk/index.js";

describe("Kiosk API Layer Integration Tests (Phase 6)", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let adminBUser: any;

  let adminAToken: string;
  let adminBToken: string;

  const testSecret = "kiosk-super-secure-jwt-and-signing-secret-key-123456";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up any stale test orgs first
    await Organization.deleteMany({ slug: { $in: ["kiosk-org-a", "kiosk-org-b"] } });

    // Seed organizations
    const orgA = await Organization.create({
      name: "Kiosk Org A",
      slug: "kiosk-org-a",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Kiosk Org B",
      slug: "kiosk-org-b",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Clean old test objects for these specific organizations
    await User.deleteMany({ "auth.email": { $in: ["kiosk-admin-a@test.com", "kiosk-admin-b@test.com"] } });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskAnalyticsModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // Seed admin users
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: { email: "kiosk-admin-a@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false
    });

    adminBUser = await User.create({
      organizationId: orgBId,
      auth: { email: "kiosk-admin-b@test.com", passwordHash: "placeholder", failedLoginAttempts: 0 },
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
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await KioskAnalyticsModel.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });

    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("Journey Builder REST API", () => {
    let createdJourneyId: string;

    const validJourneyPayload = {
      title: "Frontline Machine Safety Guide",
      description: "Audio-visual instruction manual for factory floor equipment.",
      languages: ["en", "es"],
      steps: [
        {
          id: "step-1",
          type: "instruction_step",
          title: "Safety Instructions",
          order: 1,
          interaction: {
            type: "tap_to_continue"
          },
          blocks: [
            {
              id: "block-1",
              type: "text",
              order: 1,
              mediaReferences: {
                en: { textValue: "Wear protective goggles before operation." },
                es: { textValue: "Use gafas protectoras antes de operar." }
              },
              settings: {
                size: "medium"
              }
            }
          ]
        }
      ],
      settings: {
        autoPlay: false,
        loopForever: false,
        idleTimeoutSeconds: 60,
        autoReturnHome: true,
        hideNavigation: false,
        disableExit: true,
        security: {
          protectionType: "none"
        }
      },
      publishing: {
        status: "draft",
        version: 1
      }
    };

    it("POST /api/v1/kiosk/journeys - should successfully create a new kiosk journey", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/journeys",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: validJourneyPayload
      });

            if (response.statusCode !== 201) {
        console.log("Validation Failure Details:", response.payload);
      }
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data._id).toBeDefined();
      createdJourneyId = body.data._id;
    });

    it("GET /api/v1/kiosk/journeys - should retrieve all draft/published journeys for the organization", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/journeys",
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data[0]._id).toBe(createdJourneyId);
    });

    it("PUT /api/v1/kiosk/journeys/:id - should successfully update journey draft options", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/kiosk/journeys/${createdJourneyId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Updated Machine Safety Guide"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Updated Machine Safety Guide");
    });

    it("GET /api/v1/kiosk/journeys/:id - should prevent tenant crossover", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${createdJourneyId}`,
        headers: { authorization: `Bearer ${adminBToken}` }
      });

      expect(response.statusCode).toBe(404);
    });

    it("POST /api/v1/kiosk/journeys/:id/publish - should validate and publish journey", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${createdJourneyId}/publish`,
        headers: { authorization: `Bearer ${adminAToken}` }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.publishing.status).toBe("published");
    });
  });

  describe("Device Pairing & Telemetry endpoints", () => {
    const deviceId = "terminal-guid-101";
    let pairingCode: string;
    let deviceToken: string;

    it("POST /api/v1/kiosk/devices/pair/code - should generate a pairing code for the admin", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair/code",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { deviceId }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.code).toMatch(/^\d{6}$/);
      pairingCode = body.data.code;
    });

    it("POST /api/v1/kiosk/devices/pair - should pair the hardware device and return signed JWT", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/pair",
        payload: {
          code: pairingCode,
          deviceId,
          name: "Front Gate Tablet",
          location: "Warehouse Entryway"
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.token).toBeDefined();
      expect(body.data.device.name).toBe("Front Gate Tablet");
      deviceToken = body.data.token;
    });

    it("POST /api/v1/kiosk/devices/heartbeat - should record diagnostics", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/devices/heartbeat",
        headers: { authorization: `Bearer ${deviceToken}` },
        payload: {
          currentContentVersion: 1,
          telemetry: {
            batteryLevel: 0.95,
            isCharging: true,
            storageFreeBytes: 5000000,
            networkLatencyMs: 12
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.telemetry.batteryLevel).toBe(0.95);
    });
  });

  describe("Public Playback & Security endpoints", () => {
    let journeyWithPINId: string;
    let signedJourneyId: string;

    beforeAll(async () => {
      // 1. Create a journey protected by PIN
      const pinJourney = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "PIN Restricted Journey",
        languages: ["en"],
        steps: [],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 30,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: {
            protectionType: "pin",
            pinCode: "5555"
          }
        },
        publishing: { status: "draft", version: 1 },
        createdBy: adminAUser._id.toString(),
        isDeleted: false
      });
      journeyWithPINId = pinJourney._id.toString();

      // 2. Create a journey protected by Signed URL
      const signedJourney = await KioskJourneyModel.create({
        organizationId: orgAId,
        title: "Cryptographic signed URL Journey",
        languages: ["en"],
        steps: [],
        settings: {
          autoPlay: false,
          loopForever: false,
          idleTimeoutSeconds: 30,
          autoReturnHome: true,
          hideNavigation: false,
          disableExit: true,
          security: {
            protectionType: "signed_url",
            expiresAt: new Date(Date.now() + 60000)
          }
        },
        publishing: { status: "published", version: 1 },
        createdBy: adminAUser._id.toString(),
        isDeleted: false
      });
      signedJourneyId = signedJourney._id.toString();
    });

    it("POST /api/v1/kiosk/journeys/:id/auth/pin - validate entry PIN", async () => {
      // Valid pin
      const res1 = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyWithPINId}/auth/pin`,
        payload: { pinCode: "5555" }
      });
      expect(res1.statusCode).toBe(200);
      expect(JSON.parse(res1.payload).success).toBe(true);

      // Invalid pin
      const res2 = await app.inject({
        method: "POST",
        url: `/api/v1/kiosk/journeys/${journeyWithPINId}/auth/pin`,
        payload: { pinCode: "0000" }
      });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.payload).success).toBe(false);
    });

    it("GET /api/v1/kiosk/journeys/play/:id - secure HMAC signed URL verification", async () => {
      const securityService = new KioskSecurityService();
      const exp = Math.floor(Date.now() / 1000) + 300;

      // Access signature secret from app settings
      const appSecret = config.jwt.secret;
      const sig = securityService.generateSignature(signedJourneyId, orgAId.toString(), exp, appSecret);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/play/${signedJourneyId}?o=${orgAId.toString()}&exp=${exp}&sig=${sig}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Cryptographic signed URL Journey");
    });
  });

  describe("Kiosk Public Upload Assets Access", () => {
    let publicUploadId: string;
    let privateUploadId: string;

    beforeAll(async () => {
      // Seed public upload
      const pubUpload = await mongoose.model("Upload").create({
        organizationId: orgAId,
        fileName: "test-audio.mp3",
        originalFileName: "original-audio.mp3",
        extension: "mp3",
        mimeType: "audio/mpeg",
        fileSizeBytes: 1024,
        type: "audio",
        storage: {
          provider: "cloudflare-r2",
          bucket: "talnova-onboarding",
          objectKey: "test/audio.mp3",
          publicUrl: "https://onb-storage.talnova.io/test/audio.mp3"
        },
        ownership: {
          uploadedBy: adminAUser._id,
          uploadedAt: new Date()
        },
        security: {
          visibility: "public",
          virusScanned: true,
          virusScanStatus: "clean"
        },
        lifecycle: {
          status: "active"
        }
      });
      publicUploadId = pubUpload._id.toString();

      // Seed private upload
      const privUpload = await mongoose.model("Upload").create({
        organizationId: orgAId,
        fileName: "private-audio.mp3",
        originalFileName: "private-audio.mp3",
        extension: "mp3",
        mimeType: "audio/mpeg",
        fileSizeBytes: 1024,
        type: "audio",
        storage: {
          provider: "cloudflare-r2",
          bucket: "talnova-onboarding",
          objectKey: "test/private.mp3"
        },
        ownership: {
          uploadedBy: adminAUser._id,
          uploadedAt: new Date()
        },
        security: {
          visibility: "private",
          virusScanned: true,
          virusScanStatus: "clean"
        },
        lifecycle: {
          status: "active"
        }
      });
      privateUploadId = privUpload._id.toString();
    });

    afterAll(async () => {
      await mongoose.model("Upload").deleteMany({ _id: { $in: [publicUploadId, privateUploadId] } });
    });

    it("GET /api/v1/kiosk/uploads/:id - should redirect to publicUrl for public upload", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/uploads/${publicUploadId}`
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toBe("https://onb-storage.talnova.io/test/audio.mp3");
    });

    it("GET /api/v1/kiosk/uploads/:id - should generate signed URL and redirect for private/local fallback upload", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/uploads/${privateUploadId}`
      });

      expect(response.statusCode).toBe(302);
      expect(response.headers.location).toContain("test/private.mp3");
      expect(response.headers.location).toContain("X-Amz-Signature");
    });
  });
});
