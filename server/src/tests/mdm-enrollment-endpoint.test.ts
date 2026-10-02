import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Organization from "../modules/organizations/models/organization.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";

describe("K-ENT-002: MDM Zero-Touch Bulk Enrollment Endpoint (POST /api/v1/kiosk/devices/enroll/mdm)", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  const testOrgSlug = "mdm-test-facility";
  const mdmSecret = "super-secure-mdm-enroll-secret-2026";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up previous test artifacts
    await Organization.deleteMany({ slug: testOrgSlug });

    const dummyId = new mongoose.Types.ObjectId();

    // Create test organization with MDM enrollment secret in kioskSettings
    const org = await Organization.create({
      name: "MDM Test Facility",
      slug: testOrgSlug,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      kioskSettings: {
        mdmEnrollmentSecret: mdmSecret,
      },
    });
    testOrgId = org._id.toString();

    // Clean up any test devices
    await KioskDeviceModel.deleteMany({ organizationId: org._id });
  });

  afterAll(async () => {
    await KioskDeviceModel.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  it("successfully enrolls a new tablet via MDM Managed AppConfig without 6-digit codes", async () => {
    const payload = {
      organizationSlug: testOrgSlug,
      enrollmentSecret: mdmSecret,
      deviceHardwareId: "HW-MDM-TABLET-001",
      deviceName: "Assembly Floor Kiosk A",
      location: "Assembly Line 4",
      deviceModel: "Samsung Galaxy Tab Active4 Pro",
      osVersion: "Android 14",
      appVersion: "2.4.0",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/enroll/mdm",
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.deviceToken).toBeDefined();
    expect(body.token).toBeDefined();
    expect(body.device).toBeDefined();
    expect(body.device.name).toBe("Assembly Floor Kiosk A");
    expect(body.device.location).toBe("Assembly Line 4");
    expect(body.device.deviceId).toBe("HW-MDM-TABLET-001");
    expect(body.device.status).toBe("online");
    expect(body.device.paired).toBe(true);

    // Verify record in MongoDB
    const dbDevice = await KioskDeviceModel.findOne({ deviceId: "HW-MDM-TABLET-001" });
    expect(dbDevice).not.toBeNull();
    expect(dbDevice?.organizationId.toString()).toBe(testOrgId);
    expect(dbDevice?.paired).toBe(true);
    expect(dbDevice?.status).toBe("online");
    expect(dbDevice?.tokenRef).toBeDefined();
    expect(dbDevice?.tokenExpiresAt).toBeDefined();
  });

  it("re-enrolls existing device gracefully without duplicate error", async () => {
    const payload = {
      organizationSlug: testOrgSlug,
      enrollmentSecret: mdmSecret,
      deviceId: "HW-MDM-TABLET-001",
      name: "Assembly Floor Kiosk A (Updated)",
      location: "Assembly Line 4 - Gate B",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/enroll/mdm",
      payload,
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.device.name).toBe("Assembly Floor Kiosk A (Updated)");
    expect(body.device.location).toBe("Assembly Line 4 - Gate B");

    // Still only one device in database
    const count = await KioskDeviceModel.countDocuments({ deviceId: "HW-MDM-TABLET-001" });
    expect(count).toBe(1);
  });

  it("rejects enrollment when enrollmentSecret does not match configured secret (401)", async () => {
    const payload = {
      organizationSlug: testOrgSlug,
      enrollmentSecret: "wrong-secret-token",
      deviceHardwareId: "HW-MDM-TABLET-002",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/enroll/mdm",
      payload,
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.code).toBe("INVALID_ENROLLMENT_SECRET");
  });

  it("rejects enrollment when organization slug is not found (404)", async () => {
    const payload = {
      organizationSlug: "non-existent-facility-slug-9999",
      enrollmentSecret: mdmSecret,
      deviceHardwareId: "HW-MDM-TABLET-003",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/enroll/mdm",
      payload,
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("ORGANIZATION_NOT_FOUND");
  });

  it("rejects enrollment when missing required parameters (400)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/enroll/mdm",
      payload: {
        organizationSlug: testOrgSlug,
        // missing enrollmentSecret and deviceId
      },
    });

    expect([400, 422]).toContain(res.statusCode);
  });
});
