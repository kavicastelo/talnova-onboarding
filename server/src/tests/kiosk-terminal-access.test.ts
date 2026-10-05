import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import {
  KioskJourneyModel,
  KioskDeviceModel
} from "../modules/kiosk/index.js";

describe("Kiosk Terminal Identity & Journey Playback Access", () => {
  let app: any;
  let orgId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let employeeUser: any;
  let publishedJourney: any;
  let draftJourney: any;
  let pairedDevice: any;
  let deviceToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    // Clean up previous runs
    await Organization.deleteMany({ slug: { $in: ["kiosk-access-org", "kiosk-other-org"] } });

    const org = await Organization.create({
      name: "Kiosk Access Org",
      slug: "kiosk-access-org",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgId = org._id as mongoose.Types.ObjectId;

    const otherOrg = await Organization.create({
      name: "Other Org",
      slug: "kiosk-other-org",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false
    });
    orgBId = otherOrg._id as mongoose.Types.ObjectId;

    // Seed Frontline Worker Employee
    employeeUser = await User.create({
      organizationId: orgId,
      auth: {
        email: "worker.john@kiosk-access.com",
        passwordHash: "dummy-hash",
        failedLoginAttempts: 0
      },
      profile: {
        firstName: "John",
        lastName: "Doe",
        displayName: "John Doe"
      },
      permissions: {
        role: "employee"
      },
      employment: {
        employeeId: "EMP-9876",
        badgeId: "BDG-54321",
        nationalId: "NAT-112233",
        department: "Logistics & Warehousing",
        status: "active"
      },
      isDeleted: false
    });

    // Seed Journeys
    publishedJourney = await KioskJourneyModel.create({
      organizationId: orgId,
      journeyCode: "PUB-JOURNEY-001",
      title: "Warehouse Safety Protocols 2026",
      description: "Standard industrial safety for frontline team",
      status: "published",
      version: 1,
      publishing: {
        status: "published",
        publishedAt: new Date()
      },
      settings: {
        security: {
          pinCode: "1234"
        },
        timeoutSeconds: 120,
        allowedLanguages: ["en"],
        defaultLanguage: "en"
      },
      slides: [
        {
          id: "slide-1",
          type: "text",
          title: "Safety First",
          content: "Always wear safety helmets and steel-toe boots.",
          order: 1,
          duration: 30
        }
      ],
      complianceRequirements: {
        requireSupervisorVerification: false,
        requireIdentityVerification: true
      },
      createdBy: employeeUser._id,
      publishedAt: new Date()
    });

    draftJourney = await KioskJourneyModel.create({
      organizationId: orgId,
      journeyCode: "DRF-JOURNEY-002",
      title: "Unreleased Internal Procedures",
      description: "Draft procedures undergoing internal review",
      status: "draft",
      version: 1,
      publishing: {
        status: "draft"
      },
      settings: {
        security: {
          pinCode: "1234"
        },
        timeoutSeconds: 120,
        allowedLanguages: ["en"],
        defaultLanguage: "en"
      },
      slides: [
        {
          id: "slide-1",
          type: "text",
          title: "Draft Info",
          content: "Confidential draft info.",
          order: 1,
          duration: 30
        }
      ],
      createdBy: employeeUser._id
    });

    // Seed paired Kiosk device
    const deviceId = `KIOSK-DEV-${Date.now()}`;
    await KioskDeviceModel.deleteMany({ organizationId: orgId });
    deviceToken = app.jwt.sign({
      deviceId,
      organizationId: orgId.toString(),
      role: "kiosk_device"
    });
    const tokenRef = crypto.createHash("sha256").update(deviceToken).digest("hex");

    pairedDevice = await KioskDeviceModel.create({
      organizationId: orgId,
      deviceId,
      name: "Warehouse North Terminal 1",
      location: "Warehouse North",
      deviceGroup: "Logistics",
      guid: "550e8400-e29b-41d4-a716-446655440000",
      status: "online",
      paired: true,
      pairingCode: "999888",
      tokenRef,
      lastHeartbeat: new Date(),
      networkInfo: {
        ipAddress: "192.168.1.100"
      },
      hardwareInfo: {
        platform: "Electron/Linux",
        displayResolution: "1920x1080",
        appVersion: "1.0.0"
      }
    });
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: { $in: [orgId, orgBId] } });
    await KioskJourneyModel.deleteMany({ organizationId: { $in: [orgId, orgBId] } });
    await KioskDeviceModel.deleteMany({ organizationId: { $in: [orgId, orgBId] } });
    await Organization.deleteMany({ _id: { $in: [orgId, orgBId] } });
    await disconnectDatabase(app.log);
  });

  describe("Employee Identification via Multiple Modalities (K-EMP-001)", () => {
    it("should identify employee by employeeId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          employeeId: "EMP-9876",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.worker.id).toBe(employeeUser._id.toString());
      expect(data.data.worker.fullName).toBe("John Doe");
      expect(data.data.worker.employeeId).toBe("EMP-9876");
      expect(data.data.token).toBeDefined();
    });

    it("should identify employee by badgeId", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          badgeId: "BDG-54321",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.worker.fullName).toBe("John Doe");
      expect(data.data.worker.badgeId).toBe("BDG-54321");
    });

    it("should identify employee by batchId alias", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          batchId: "BDG-54321",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.worker.fullName).toBe("John Doe");
    });

    it("should identify employee by email address (case-insensitive)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          email: "WORKER.JOHN@kiosk-access.com",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.worker.fullName).toBe("John Doe");
    });

    it("should identify employee via generic identifier field", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "NAT-112233",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data.worker.fullName).toBe("John Doe");
    });

    it("should return 404 for unknown identifier", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          identifier: "NON-EXISTENT-ID",
          kioskDeviceId: pairedDevice.deviceId,
          organizationId: orgId.toString()
        }
      });

      expect(response.statusCode).toBe(404);
      const data = response.json();
      expect(data.code).toBe("WORKER_NOT_FOUND");
    });
  });

  describe("Journey Access and Playback Security (DEF-008 & K-SEC-001)", () => {
    let frontlineWorkerToken: string;

    beforeAll(async () => {
      // Get a frontline worker token via identification
      const identifyRes = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        payload: {
          employeeId: "EMP-9876",
          organizationId: orgId.toString()
        }
      });
      frontlineWorkerToken = identifyRes.json().data.token;
    });

    it("allows paired Kiosk device to fetch published journey via GET /journeys/:id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}`,
        headers: {
          authorization: `Bearer ${deviceToken}`,
          "x-organization-id": orgId.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data._id).toBe(publishedJourney._id.toString());
      expect(data.data.title).toBe("Warehouse Safety Protocols 2026");
    });

    it("allows paired Kiosk device to fetch published journey via GET /journeys/play/:id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/play/${publishedJourney._id}`,
        headers: {
          authorization: `Bearer ${deviceToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data._id).toBe(publishedJourney._id.toString());
    });

    it("allows identified Frontline Worker to fetch journey via worker session token", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}`,
        headers: {
          authorization: `Bearer ${frontlineWorkerToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data._id).toBe(publishedJourney._id.toString());
    });

    it("allows public access to published journey on /journeys/play/:id without credentials", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/play/${publishedJourney._id}?organizationId=${orgId.toString()}`
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.success).toBe(true);
      expect(data.data._id).toBe(publishedJourney._id.toString());
    });

    it("blocks unauthenticated access to draft journey", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/play/${draftJourney._id}?organizationId=${orgId.toString()}`
      });

      expect(response.statusCode).toBe(403);
    });

    it("blocks cross-tenant access between different organizations", async () => {
      const foreignDeviceId = "OTHER-DEV-001";
      const foreignDeviceToken = app.jwt.sign({
        deviceId: foreignDeviceId,
        organizationId: orgBId.toString(),
        role: "kiosk_device"
      });
      const foreignTokenRef = crypto.createHash("sha256").update(foreignDeviceToken).digest("hex");
      await KioskDeviceModel.create({
        organizationId: orgBId,
        deviceId: foreignDeviceId,
        name: "Foreign Terminal",
        location: "Foreign Location",
        status: "online",
        paired: true,
        tokenRef: foreignTokenRef
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/journeys/${publishedJourney._id}`,
        headers: {
          authorization: `Bearer ${foreignDeviceToken}`
        }
      });

      // Secure multi-tenant boundary: foreign tenant receives 403 or 404 (resource not found in tenant)
      expect([403, 404]).toContain(response.statusCode);
    });
  });
});
