import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";
import { KioskSessionModel } from "../modules/kiosk/models/kiosk-session.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyVersionModel } from "../modules/kiosk/models/kiosk-journey-version.model.js";
import { kioskCertificateService } from "../modules/kiosk/services/kiosk-certificate.service.js";

describe("K-CMP-002: Verifiable Completion Certificate Generation & Public Verification", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let frontlineWorker: any;
  let supervisorUser: any;
  let kioskDevice: any;
  let testJourney: any;
  let completedSession: any;
  let activeSession: any;

  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Apex Petrochemical Refinery",
      slug: `apex-refinery-${ts}`,
      createdBy: dummyAdminId,
      branding: {
        primaryColor: "#059669",
      },
      isDeleted: false,
    });

    // 2. Create Supervisor Witness
    supervisorUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `supervisor-cert-${ts}@apex.com`,
        passwordHash: "hashed_pwd_sup",
      },
      profile: {
        firstName: "Marcus",
        lastName: "Vance",
      },
      role: "manager",
      status: "active",
      isDeleted: false,
    });

    // 3. Create Frontline Worker
    frontlineWorker = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `worker-cert-${ts}@apex.com`,
        passwordHash: "hashed_pwd_worker",
      },
      profile: {
        firstName: "Tariq",
        lastName: "Al-Mansoor",
      },
      employment: {
        employeeId: `EMP-CERT-${ts}`,
        badgeId: `BADGE-CERT-${ts}`,
        department: "Cat-Cracker Unit 4",
      },
      role: "frontline_worker_kiosk",
      status: "active",
      isDeleted: false,
    });

    // 4. Create Kiosk Terminal Device
    kioskDevice = await KioskDeviceModel.create({
      organizationId: testOrg._id,
      deviceId: `HW-GUID-APEX-${ts}`,
      hardwareGuid: `HW-GUID-APEX-${ts}`,
      name: "Turnstile Gate Alpha Kiosk",
      location: "East Perimeter Turnstile #2",
      status: "online",
      isPaired: true,
      lastSeen: new Date(),
    });

    // 5. Create Kiosk Journey & Published Snapshot
    testJourney = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      title: "H2S & Confined Space Entry Protocol",
      description: "Mandatory refinery turnstile safety induction",
      languages: ["en"],
      createdBy: dummyAdminId,
      isDeleted: false,
      steps: [
        {
          id: "step-intro",
          type: "content",
          order: 0,
          title: "Atmospheric Hazards",
          isMandatory: true,
          blocks: [
            {
              id: "b1",
              type: "text",
              order: 0,
              content: "Check detector before entry.",
            },
          ],
          interaction: {
            type: "tap_anywhere",
          },
        },
      ],
      settings: {
        minimumDurationSeconds: 1,
        enforceMandatorySteps: true,
        security: {
          requireSupervisorWitness: true,
        },
      },
      publishing: {
        status: "published",
        version: 2,
        publishedAt: new Date(),
        publishedBy: dummyAdminId,
      },
    });

    const journeyVersion = await KioskJourneyVersionModel.create({
      journeyId: testJourney._id,
      organizationId: testOrg._id,
      version: 2,
      title: testJourney.title,
      steps: testJourney.steps,
      languages: testJourney.languages,
      settings: testJourney.settings,
      contentChecksum: "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
      publishedBy: dummyAdminId,
      publishedAt: new Date(),
    });

    // 6. Create Completed Kiosk Session with verificationChecksum & Supervisor Witness
    const completedAt = new Date();
    completedSession = await KioskSessionModel.create({
      organizationId: testOrg._id,
      deviceId: kioskDevice._id,
      journeyId: testJourney._id,
      journeyVersionId: journeyVersion._id,
      versionNumber: 2,
      userId: frontlineWorker._id,
      sessionToken: `token-completed-${ts}`,
      status: "completed",
      startedAt: new Date(Date.now() - 120000),
      completedAt,
      durationSeconds: 120,
      currentStepId: "step-intro",
      completedStepIds: ["step-intro"],
      verificationChecksum: "a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef",
      supervisorWitness: {
        supervisorId: supervisorUser._id,
        witnessedAt: completedAt,
        method: "pin",
      },
      isOfflineSync: false,
    });

    // 7. Create Active (Uncompleted) Kiosk Session
    activeSession = await KioskSessionModel.create({
      organizationId: testOrg._id,
      deviceId: kioskDevice._id,
      journeyId: testJourney._id,
      versionNumber: 2,
      userId: frontlineWorker._id,
      sessionToken: `token-active-${ts}`,
      status: "active",
      startedAt: new Date(),
      durationSeconds: 15,
      currentStepId: "step-intro",
      completedStepIds: [],
      isOfflineSync: false,
    });
  });

  afterAll(async () => {
    try {
      await KioskSessionModel.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyVersionModel.collection.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    } catch (e) {
      // Ignore cleanup error
    }
    await app.close();
  });

  describe("KioskCertificateService: Unit Tests", () => {
    it("generates structured certificate data for a completed session", async () => {
      const certData = await kioskCertificateService.generateCertificateData(completedSession._id.toString());

      expect(certData).toBeDefined();
      expect(certData.certificateId).toBe(completedSession._id.toString());
      expect(certData.certificateNumber).toMatch(/^CERT-KSK-/);
      expect(certData.recipientName).toBe("Tariq Al-Mansoor");
      expect(certData.employeeId).toBe(`EMP-CERT-${ts}`);
      expect(certData.organizationName).toBe("Apex Petrochemical Refinery");
      expect(certData.journeyTitle).toBe("H2S & Confined Space Entry Protocol");
      expect(certData.versionNumber).toBe(2);
      expect(certData.durationSeconds).toBe(120);
      expect(certData.formattedDuration).toBe("2m 0s");
      expect(certData.terminalName).toBe("Turnstile Gate Alpha Kiosk");
      expect(certData.hardwareGuid).toBe(`HW-GUID-APEX-${ts}`);
      expect(certData.physicalLocation).toBe("East Perimeter Turnstile #2");
      expect(certData.verificationChecksum).toBe("a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef");
      expect(certData.isAuthentic).toBe(true);
      expect(certData.badge).toBe("VERIFIED AUTHENTIC");
      expect(certData.qrCodeUrl).toContain(`/verify/cert/${completedSession._id}`);

      // Supervisor witness details
      expect(certData.supervisorWitness).toBeDefined();
      expect(certData.supervisorWitness?.name).toBe("Marcus Vance");
      expect(certData.supervisorWitness?.method).toBe("pin");
      expect(certData.supervisorWitness?.attestation).toContain("PIN");
    });

    it("rejects certificate generation for an uncompleted session", async () => {
      await expect(
        kioskCertificateService.generateCertificateData(activeSession._id.toString())
      ).rejects.toThrow("Cannot issue completion certificate for session with status 'active'");
    });

    it("throws 404 when session is not found", async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await expect(
        kioskCertificateService.generateCertificateData(nonExistentId)
      ).rejects.toThrow(`Kiosk session not found: ${nonExistentId}`);
    });

    it("generates a high-resolution vector SVG certificate with all regulatory requirements", async () => {
      const certData = await kioskCertificateService.generateCertificateData(completedSession._id.toString());
      const svg = await kioskCertificateService.generateSvgCertificate(certData);

      expect(svg).toBeDefined();
      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('viewBox="0 0 1200 850"');

      // Worker Full Name & Employee ID
      expect(svg).toContain("Tariq Al-Mansoor");
      expect(svg).toContain(`EMP-CERT-${ts}`);

      // Journey Title & Version Snapshot Number
      expect(svg).toContain("H2S &amp; Confined Space Entry Protocol");
      expect(svg).toContain("Version 2.0 (Published Snapshot Snapshot #2)");

      // Duration & Terminal Hardware GUID & Physical Location
      expect(svg).toContain("2m 0s");
      expect(svg).toContain(`HW-GUID-APEX-${ts}`);
      expect(svg).toContain("East Perimeter Turnstile #2");

      // Supervisor Witness & Attestation
      expect(svg).toContain("Marcus Vance");
      expect(svg).toContain("PIN");

      // SHA-256 Verification Checksum
      expect(svg).toContain("a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef");

      // Scannable QR Code element
      expect(svg).toContain('id="scannable-qr-code"');

      // Official green "VERIFIED AUTHENTIC" badge
      expect(svg).toContain('id="verified-authentic-badge"');
      expect(svg).toContain("VERIFIED AUTHENTIC");
    });
  });

  describe("Public Verification Endpoint: GET /api/v1/public/certificates/verify/:id", () => {
    it("returns 200 with authentic completion details and green badge for valid session ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/public/certificates/verify/${completedSession._id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);

      expect(body.success).toBe(true);
      expect(body.verified).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.certificateId).toBe(completedSession._id.toString());
      expect(body.data.recipientName).toBe("Tariq Al-Mansoor");
      expect(body.data.employeeId).toBe(`EMP-CERT-${ts}`);
      expect(body.data.organizationName).toBe("Apex Petrochemical Refinery");
      expect(body.data.journeyTitle).toBe("H2S & Confined Space Entry Protocol");
      expect(body.data.versionNumber).toBe(2);
      expect(body.data.durationSeconds).toBe(120);
      expect(body.data.terminalName).toBe("Turnstile Gate Alpha Kiosk");
      expect(body.data.hardwareGuid).toBe(`HW-GUID-APEX-${ts}`);
      expect(body.data.physicalLocation).toBe("East Perimeter Turnstile #2");
      expect(body.data.location).toBe("East Perimeter Turnstile #2");
      expect(body.data.verificationChecksum).toBe("a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef");
      expect(body.data.isAuthentic).toBe(true);
      expect(body.data.badge).toBe("VERIFIED AUTHENTIC");
      expect(body.data.status).toBe("active");

      // Supervisor witness info
      expect(body.data.supervisorWitness).toBeDefined();
      expect(body.data.supervisorWitness.name).toBe("Marcus Vance");
      expect(body.data.supervisorWitness.method).toBe("pin");
    });

    it("returns 200 when queried via certificateNumber", async () => {
      const certData = await kioskCertificateService.generateCertificateData(completedSession._id.toString());

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/public/certificates/verify/${certData.certificateNumber}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.verified).toBe(true);
      expect(body.data.recipientName).toBe("Tariq Al-Mansoor");
      expect(body.data.badge).toBe("VERIFIED AUTHENTIC");
    });

    it("returns 400 when verifying an uncompleted session", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/public/certificates/verify/${activeSession._id}`,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.message).toContain("Must be 'completed'");
    });

    it("returns 404 for an invalid or non-existent certificate ID", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/public/certificates/verify/${fakeId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(false);
      expect(body.message).toBe("No certificates found");
    });
  });

  describe("Kiosk Session Certificate Endpoints", () => {
    it("GET /api/v1/kiosk/sessions/:id/certificate returns 200 with structured certificate JSON", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/sessions/${completedSession._id}/certificate`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.data.recipientName).toBe("Tariq Al-Mansoor");
      expect(body.data.verificationChecksum).toBe("a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef");
      expect(body.data.qrCodeSvg).toBeDefined();
    });

    it("GET /api/v1/kiosk/sessions/:id/certificate/svg returns 200 with image/svg+xml and valid SVG content", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/kiosk/sessions/${completedSession._id}/certificate/svg`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.payload).toContain("<svg");
      expect(response.payload).toContain("Tariq Al-Mansoor");
      expect(response.payload).toContain("VERIFIED AUTHENTIC");
      expect(response.payload).toContain('id="scannable-qr-code"');
    });
  });
});
