import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import crypto from "crypto";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { KioskDeviceModel } from "../modules/kiosk/models/kiosk-device.model.js";
import { KioskJourneyModel } from "../modules/kiosk/models/kiosk-journey.model.js";

describe("Journey Test UJ-KSK-001: Pair Kiosk Device via 6-Digit Code", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let employeeUser: any;
  let adminToken: string;
  let employeeToken: string;
  let generatedCode: string;
  let issuedDeviceToken: string;
  let pairedDeviceId: string;

  const testHardwareGuid = "TEST-KIOSK-001";
  const testDeviceName = "Assembly Floor Terminal";
  const testDeviceLocation = "Building 3";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Kiosk Test Org ${ts}`,
      slug: `kiosk-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `kiosk-admin-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Terminal",
        lastName: "Admin",
      },
      employment: {
        department: "IT Operations",
        jobTitle: "Systems Administrator",
        status: "active",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Regular Employee User (for authorization tests)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `kiosk-employee-${ts}@test.com`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Standard",
        lastName: "Operator",
      },
      employment: {
        department: "Production",
        jobTitle: "Line Worker",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // Clean up any existing test device
    await KioskDeviceModel.deleteMany({ deviceId: testHardwareGuid });
  });

  afterAll(async () => {
    if (testOrg) {
      await KioskDeviceModel.deleteMany({ organizationId: testOrg._id });
      await KioskJourneyModel.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
  });

  it("Step 1-6: Admin generates 6-digit device pairing code (POST /api/v1/kiosk/devices/pair/code)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/pair/code",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        deviceId: testHardwareGuid,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    // Assert code format and expiry
    generatedCode = body.code || body.data?.code;
    expect(generatedCode).toBeDefined();
    expect(generatedCode).toMatch(/^\d{6}$/);

    const expiresInSeconds = body.expiresInSeconds || body.data?.expiresInSeconds;
    expect(expiresInSeconds).toBe(900); // 15 minutes
  });

  it("Step 7-8: Physical terminal submits code and receives deviceToken (POST /api/v1/kiosk/devices/pair)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/pair",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        code: generatedCode,
        deviceId: testHardwareGuid,
        name: testDeviceName,
        location: testDeviceLocation,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    // Step 8: Assert response returns deviceToken and device: { id, name }
    const deviceToken = body.deviceToken || body.data?.deviceToken || body.data?.token;
    expect(deviceToken).toBeDefined();
    expect(typeof deviceToken).toBe("string");
    issuedDeviceToken = deviceToken;

    const device = body.device || body.data?.device;
    expect(device).toBeDefined();
    expect(device.name).toBe(testDeviceName);
    expect(device.deviceId).toBe(testHardwareGuid);
    pairedDeviceId = device.id || device._id;
    expect(pairedDeviceId).toBeDefined();

    // Verify JWT payload claims
    const decoded: any = app.jwt.decode(deviceToken);
    expect(decoded.role).toBe("kiosk_device");
    expect(decoded.deviceId).toBe(testHardwareGuid);
    expect(decoded.organizationId).toBe(testOrg._id.toString());
  });

  it("Step 9: Admin lists devices and asserts terminal is listed with status online/paired (GET /api/v1/kiosk/devices)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/kiosk/devices",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const devices = body.data || [];
    const matched = devices.find((d: any) => d.deviceId === testHardwareGuid);
    expect(matched).toBeDefined();
    expect(matched.name).toBe(testDeviceName);
    expect(matched.location).toBe(testDeviceLocation);
    expect(matched.status).toBe("online");
    expect(matched.paired).toBe(true);
  });

  it("Negative Test: Submit invalid pairing code (999999) returns HTTP 400 with INVALID_OR_EXPIRED_PAIRING_CODE", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/pair",
      headers: {
        "Content-Type": "application/json",
      },
      payload: {
        code: "999999",
        deviceId: "TEST-KIOSK-002",
        name: "Gate 2 Terminal",
        location: "Warehouse North",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.code).toBe("INVALID_OR_EXPIRED_PAIRING_CODE");
  });

  it("Authorization Test: Unauthorized regular employee cannot generate pairing codes (HTTP 403 Forbidden)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/pair/code",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        deviceId: "TEST-KIOSK-UNAUTH",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Data Integrity Checks: MongoDB KioskDevice stores hardwareGuid, hashed token reference, and tenant ID", async () => {
    const storedDevice = await KioskDeviceModel.findOne({ deviceId: testHardwareGuid });
    expect(storedDevice).toBeDefined();
    expect(storedDevice?.hardwareGuid).toBe(testHardwareGuid);
    expect(storedDevice?.paired).toBe(true);
    expect(storedDevice?.status).toBe("online");
    expect(storedDevice?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(storedDevice?.location).toBe(testDeviceLocation);

    // Verify tokenRef matches sha256 hash of deviceToken
    const expectedHash = crypto.createHash("sha256").update(issuedDeviceToken).digest("hex");
    expect(storedDevice?.tokenRef).toBe(expectedHash);
  });

  it("Integration Check: Terminal can pair with a published kiosk journey (POST /api/v1/kiosk/devices/:id/pair-journey)", async () => {
    // 1. Seed a test published journey
    const journey = await KioskJourneyModel.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      title: "Assembly Line Onboarding & Safety Briefing",
      description: "Interactive factory floor worker briefing",
      journeyCode: `ksk-jrn-${Date.now()}`,
      status: "published",
      languages: ["en"],
      steps: [
        {
          id: "step-1",
          type: "standard_step",
          title: "Safety Overview",
          order: 0,
          blocks: [
            {
              id: "block-text-01",
              type: "text",
              order: 0,
              mediaReferences: {
                en: {
                  textValue: "Welcome to the frontline safety briefing.",
                },
              },
            },
          ],
          interaction: {
            type: "tap_to_continue",
          },
        },
      ],
      publishing: {
        status: "published",
        publishedAt: new Date(),
      },
      settings: {
        security: {
          pinCode: "1234",
        },
        timeoutSeconds: 120,
        allowedLanguages: ["en"],
        defaultLanguage: "en",
      },
    });

    // 2. Call pair-journey endpoint
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/kiosk/devices/${pairedDeviceId}/pair-journey`,
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      payload: {
        journeyId: journey._id.toString(),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.currentJourneyId.toString()).toBe(journey._id.toString());

    // Verify persistence in MongoDB
    const updatedDevice = await KioskDeviceModel.findById(pairedDeviceId);
    expect(updatedDevice?.currentJourneyId?.toString()).toBe(journey._id.toString());
  });
});
