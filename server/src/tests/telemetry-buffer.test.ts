import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import TelemetryBuffer from "../infrastructure/telemetry/telemetry-buffer.js";

describe("Super Admin Telemetry Suite: SA-OBS-001 In-Memory API Request Telemetry Ring Buffer", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `sa-obs-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Observability Corp ${testPrefix}`,
      slug: `obs-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `obs-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Observability",
        lastName: "Admin",
        fullName: "Observability Admin",
      },
      employment: {
        department: "SRE",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Create Non-Admin User for RBAC testing
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `obs-staff-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Staff",
        lastName: "Engineer",
        fullName: "Staff Engineer",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Developer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    nonAdminToken = app.jwt.sign({
      userId: nonAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
    await app.close();
  });

  beforeEach(() => {
    TelemetryBuffer.clear();
  });

  it("1. Empty TelemetryBuffer returns nominal zero metrics without NaN", () => {
    const metrics = TelemetryBuffer.getMetrics();
    expect(metrics.latency.p50).toBe(0);
    expect(metrics.latency.p95).toBe(0);
    expect(metrics.latency.p99).toBe(0);
    expect(metrics.throughput.rpm).toBe(0);
    expect(metrics.throughput.successRate).toBe(100);
    expect(metrics.throughput.errorRate).toBe(0);
    expect(Array.isArray(metrics.endpoints)).toBe(true);
  });

  it("2. Records 100 requests with known latencies (1ms to 100ms) and accurately calculates P50, P95, P99", () => {
    const now = Date.now();
    for (let i = 1; i <= 100; i++) {
      TelemetryBuffer.record({
        timestamp: now - (100 - i) * 100, // all within recent window
        method: "GET",
        route: "/api/v1/test",
        statusCode: 200,
        durationMs: i,
      });
    }

    const metrics = TelemetryBuffer.getMetrics();
    expect(metrics.latency.p50).toBe(51); // index 50 of 0..99
    expect(metrics.latency.p95).toBe(96); // index 95 of 0..99
    expect(metrics.latency.p99).toBe(100); // index 99 of 0..99
    expect(metrics.throughput.rpm).toBe(100);
    expect(metrics.throughput.successRate).toBe(100);
    expect(metrics.throughput.errorRate).toBe(0);
  });

  it("3. Accurately tracks error rates on HTTP 4xx/5xx responses", () => {
    const now = Date.now();
    // 80 successful, 20 errors -> 20% error rate
    for (let i = 0; i < 80; i++) {
      TelemetryBuffer.record({
        timestamp: now,
        method: "GET",
        route: "/api/v1/success",
        statusCode: 200,
        durationMs: 25,
      });
    }
    for (let i = 0; i < 20; i++) {
      TelemetryBuffer.record({
        timestamp: now,
        method: "POST",
        route: "/api/v1/error",
        statusCode: 500,
        durationMs: 75,
      });
    }

    const metrics = TelemetryBuffer.getMetrics();
    expect(metrics.throughput.successRate).toBe(80);
    expect(metrics.throughput.errorRate).toBe(20);
    expect(metrics.throughput.rpm).toBe(100);
  });

  it("4. Ring buffer capacity wrap-around: handles 5,100 writes without exceeding 5,000 capacity", () => {
    const now = Date.now();
    for (let i = 0; i < 5100; i++) {
      TelemetryBuffer.record({
        timestamp: now,
        method: "GET",
        route: "/api/v1/high-throughput",
        statusCode: 200,
        durationMs: 15,
      });
    }

    expect(TelemetryBuffer.getCount()).toBe(5000);
    const metrics = TelemetryBuffer.getMetrics();
    expect(metrics.throughput.rpm).toBe(5000);
  });

  it("5. Fastify onResponse lifecycle hook automatically records real live HTTP requests", async () => {
    TelemetryBuffer.clear();

    // Make real requests through Fastify
    const res1 = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/search?q=test",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(res2.statusCode).toBe(200);

    // Verify ring buffer recorded the requests
    expect(TelemetryBuffer.getCount()).toBeGreaterThanOrEqual(2);

    // Call GET /observability/api
    const obsRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/observability/api",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(obsRes.statusCode).toBe(200);
    const body = JSON.parse(obsRes.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();

    // Verify dynamic computed metrics (not hardcoded mock 28/64/118)
    expect(typeof body.data.latency.p50).toBe("number");
    expect(typeof body.data.latency.p95).toBe("number");
    expect(typeof body.data.latency.p99).toBe("number");
    expect(body.data.throughput.rpm).toBeGreaterThanOrEqual(2);
    expect(body.data.throughput.successRate).toBeGreaterThan(0);
    expect(Array.isArray(body.data.endpoints)).toBe(true);

    // Verify real routes exist in the endpoints table
    const routeNames = body.data.endpoints.map((e: any) => e.route);
    const hasRecordedRoute = routeNames.some(
      (r: string) => r.includes("/telemetry") || r.includes("/search")
    );
    expect(hasRecordedRoute).toBe(true);
  });

  it("6. RBAC: Non-admin employee receives 403 Forbidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/observability/api",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
