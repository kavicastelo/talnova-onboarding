import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import Package from "../modules/super-admin/models/package.model.js";
import { superAdminService } from "../modules/super-admin/services/super-admin.service.js";

describe("Organization Limits & Quotas Enforcement + Tenant Usage Telemetry", () => {
  let app: FastifyInstance;
  let orgAdminUser: any;
  let limitedOrg: any;
  let orgAdminToken: string;

  const testRunId = `limit-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    await superAdminService.syncDefaultPackages();

    const dummyId = new mongoose.Types.ObjectId();

    // Create an organization with strict limits for testing
    limitedOrg = await Organization.create({
      name: `Strict Limits Org ${testRunId}`,
      slug: `strict-${testRunId}`,
      plan: "Freemium",
      status: "Active",
      limits: {
        maxUsers: 2, // Strict limit: 2 seats
        maxStorageGb: 5,
        maxJourneys: 1, // Strict limit: 1 journey
        maxKiosks: 1, // Strict limit: 1 kiosk
        aiTokenMonthlyLimit: 50000,
      },
      features: {
        kiosk_mode: true,
        ai_course_builder: true,
      },
      createdBy: dummyId,
      isDeleted: false,
    });

    // Create 1 admin user in this org (1 seat consumed)
    orgAdminUser = await User.create({
      organizationId: limitedOrg._id,
      auth: {
        email: `admin-${testRunId}@talnova.test`,
        passwordHash: "dummy_hash_for_test",
      },
      profile: {
        firstName: "Org",
        lastName: "Admin",
        fullName: "Org Admin",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
      employment: {
        status: "active",
      },
      isDeleted: false,
    });

    orgAdminToken = app.jwt.sign({
      userId: orgAdminUser._id.toString(),
      email: orgAdminUser.auth.email,
      role: "admin",
      organizationId: limitedOrg._id.toString(),
    });
  });

  afterAll(async () => {
    // Clean up test data
    if (limitedOrg) {
      await User.deleteMany({ organizationId: limitedOrg._id });
      await Journey.deleteMany({ organizationId: limitedOrg._id });
      await KioskDeviceModel.deleteMany({ organizationId: limitedOrg._id });
      await Organization.deleteOne({ _id: limitedOrg._id });
    }
    await app.close();
  });

  it("1. GET /api/v1/organizations/current/usage returns live metrics, limits, and utilization", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/organizations/current/usage",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Verify metrics structure
    const { metrics, limits } = body.data;
    expect(limits.maxUsers).toBe(2);
    expect(limits.maxJourneys).toBe(1);
    expect(limits.maxKiosks).toBe(1);

    // Current users should be 1 (the admin created in beforeAll)
    expect(metrics.users.current).toBe(1);
    expect(metrics.users.limit).toBe(2);
    expect(metrics.users.percent).toBe(50);
    expect(metrics.users.isExceeded).toBe(false);

    // Journeys should be 0
    expect(metrics.journeys.current).toBe(0);
    expect(metrics.journeys.limit).toBe(1);

    // Kiosks should be 0
    expect(metrics.kiosks.current).toBe(0);
    expect(metrics.kiosks.limit).toBe(1);
  });

  it("2. User seat limit: permits adding a 2nd user, then blocks 3rd user with 403 SEAT_LIMIT_REACHED", async () => {
    // Add 2nd user directly to reach limit (2/2)
    await User.create({
      organizationId: limitedOrg._id,
      auth: {
        email: `member2-${testRunId}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Second",
        lastName: "Member",
        fullName: "Second Member",
      },
      permissions: {
        role: "employee",
        roles: ["employee"],
      },
      isDeleted: false,
    });

    // Attempt to invite a 3rd user via API
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
      payload: {
        email: `member3-${testRunId}@talnova.test`,
        firstName: "Third",
        lastName: "Member",
        role: "employee",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.code || body.code).toBe("SEAT_LIMIT_REACHED");
    expect(body.message).toContain("seat limit reached");
  });

  it("3. Journey limit: permits 1st journey, blocks 2nd journey with 403 JOURNEY_LIMIT_EXCEEDED", async () => {
    // Create 1st journey (reaches 1/1 limit)
    const res1 = await app.inject({
      method: "POST",
      url: "/api/v1/journeys",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
      payload: {
        title: `First Test Journey ${testRunId}`,
        description: "Initial journey filling the quota",
      },
    });

    expect(res1.statusCode).toBe(201);

    // Attempt 2nd journey - should be rejected with 403
    const res2 = await app.inject({
      method: "POST",
      url: "/api/v1/journeys",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
      payload: {
        title: `Second Test Journey ${testRunId}`,
        description: "Exceeding the journey quota",
      },
    });

    expect(res2.statusCode).toBe(403);
    const body2 = res2.json();
    expect(body2.error?.code || body2.code).toBe("JOURNEY_LIMIT_EXCEEDED");
    expect(body2.message).toContain("journey limit reached");
  });

  it("4. Kiosk device limit: permits 1st kiosk, blocks pairing code generation for 2nd kiosk with 403 KIOSK_LIMIT_REACHED", async () => {
    // Register 1st kiosk device in DB to fill quota (1/1)
    await KioskDeviceModel.create({
      organizationId: limitedOrg._id,
      deviceId: `kiosk-hw-1-${testRunId}`,
      hardwareGuid: `kiosk-hw-1-${testRunId}`,
      name: "Front Desk Kiosk",
      location: "HQ Lobby",
      status: "online",
      paired: true,
      tokenRef: "test-token-ref",
    });

    // Attempt to generate pairing code for an unregistered 2nd hardware GUID
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/kiosk/devices/pair/code",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
      payload: {
        deviceId: `kiosk-hw-2-new-${testRunId}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error?.code || body.code).toBe("KIOSK_LIMIT_REACHED");
    expect(body.message).toContain("kiosk device limit reached");
  });

  it("5. GET /api/v1/organizations/current/usage reflects reached limits and warning flags", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/organizations/current/usage",
      headers: {
        Authorization: `Bearer ${orgAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const { metrics, warnings } = body.data;

    // Both users (2/2 = 100%), journeys (1/1 = 100%), and kiosks (1/1 = 100%) are at capacity
    expect(metrics.users.percent).toBe(100);
    expect(metrics.users.isExceeded).toBe(true);

    expect(metrics.journeys.percent).toBe(100);
    expect(metrics.journeys.isExceeded).toBe(true);

    expect(metrics.kiosks.percent).toBe(100);
    expect(metrics.kiosks.isExceeded).toBe(true);

    // Warnings list should notify about capacity limits
    expect(warnings).toContain("User seat limit reached");
    expect(warnings).toContain("Journey creation limit reached");
    expect(warnings).toContain("Kiosk station limit reached");
  });
});
