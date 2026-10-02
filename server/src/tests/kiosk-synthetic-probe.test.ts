import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Organization from "../modules/organizations/models/organization.model.js";
import KioskDeviceModel from "../modules/kiosk/models/kiosk-device.model.js";
import { kioskSyntheticProbeService } from "../modules/kiosk/services/kiosk-synthetic-probe.service.js";
import { runSyntheticProbe } from "../scripts/kiosk-synthetic-probe.js";

describe("K-REL-003: Synthetic Monitoring Probes & Automated Fleet Health Checks", () => {
  let app: FastifyInstance;
  let testOrg: any;
  const ts = Date.now();
  const dummyAdminId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Create a test organization for probe assertions
    testOrg = await Organization.create({
      name: `Synthetic Probe Org ${ts}`,
      slug: `synthetic-probe-org-${ts}`,
      status: "Active",
      createdBy: dummyAdminId,
      isDeleted: false
    });

    // Pre-warm connection for reliable synthetic probe baseline
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping().catch(() => {});
    }
  });

  afterAll(async () => {
    if (testOrg?._id) {
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await KioskDeviceModel.deleteMany({ deviceId: { $regex: /^SYNTHETIC-PROBE/ } });
    await app.close();
  });

  // =========================================================================
  // Requirement 1 & Acceptance Criteria: GET /api/v1/kiosk/health/synthetic
  // =========================================================================
  describe("GET /api/v1/kiosk/health/synthetic - Subsystem Latencies", () => {
    it("should return HTTP 200 with detailed subsystem latencies (DB, storage, auth)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/health/synthetic"
      });

      expect(response.statusCode).toBe(200);

      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(["healthy", "degraded"]).toContain(body.status);
      expect(typeof body.totalLatencyMs).toBe("number");
      expect(body.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(body.totalLatencyMs).toBeLessThan(1000); // Latency SLA < 1000ms

      // Verify Database Subsystem Latency
      expect(body.subsystems).toHaveProperty("database");
      expect(["healthy", "degraded"]).toContain(body.subsystems.database.status);
      expect(typeof body.subsystems.database.latencyMs).toBe("number");
      expect(body.subsystems.database.latencyMs).toBeGreaterThanOrEqual(0);
      expect(body.subsystems.database.details).toContain("MongoDB");

      // Verify DB alias
      expect(body.subsystems).toHaveProperty("db");
      expect(body.subsystems.db.latencyMs).toBe(body.subsystems.database.latencyMs);

      // Verify Storage Subsystem Latency
      expect(body.subsystems).toHaveProperty("storage");
      expect(["healthy", "degraded"]).toContain(body.subsystems.storage.status);
      expect(typeof body.subsystems.storage.latencyMs).toBe("number");
      expect(body.subsystems.storage.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify Auth Subsystem Latency
      expect(body.subsystems).toHaveProperty("auth");
      expect(body.subsystems.auth.status).toBe("healthy");
      expect(typeof body.subsystems.auth.latencyMs).toBe("number");
      expect(body.subsystems.auth.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify Manifest Subsystem Latency
      expect(body.subsystems).toHaveProperty("manifest");
      expect(body.subsystems.manifest.status).toBe("healthy");
      expect(typeof body.subsystems.manifest.latencyMs).toBe("number");
      expect(body.subsystems.manifest.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify Subsystem Checks Object
      expect(body.checks).toBeDefined();
      expect(body.checks.database).toBe("pass");
      expect(body.checks.auth).toBe("pass");
    });

    it("should handle degraded database state and return HTTP 503 if DB is unreachable", async () => {
      // Temporarily simulate DB ping failure
      const originalDb = mongoose.connection.db;
      try {
        (mongoose.connection as any).db = {
          admin: () => ({
            ping: async () => {
              throw new Error("Connection timed out to primary replica");
            }
          })
        };

        const response = await app.inject({
          method: "GET",
          url: "/api/v1/kiosk/health/synthetic"
        });

        expect(response.statusCode).toBe(503);
        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.status).toBe("unhealthy");
        expect(body.subsystems.database.status).toBe("unhealthy");
        expect(body.subsystems.database.error).toContain("Connection timed out");
      } finally {
        (mongoose.connection as any).db = originalDb;
      }
    });
  });

  // =========================================================================
  // Requirement 2: Synthetic Terminal Authentication & Manifest Resolution
  // =========================================================================
  describe("Synthetic Terminal Authentication & Device Manifest", () => {
    let syntheticToken = "";

    it("should authenticate as a synthetic test terminal and issue valid device credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/health/synthetic/auth",
        payload: {
          deviceId: "SYNTHETIC-PROBE-TERMINAL",
          organizationId: testOrg._id.toString()
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.deviceId).toBe("SYNTHETIC-PROBE-TERMINAL");
      expect(body.organizationId).toBe(testOrg._id.toString());
      syntheticToken = body.token;

      // Verify device was registered in MongoDB with matching tokenRef
      const device = await KioskDeviceModel.findOne({
        deviceId: "SYNTHETIC-PROBE-TERMINAL",
        organizationId: testOrg._id
      });
      expect(device).not.toBeNull();
      expect(device?.status).toBe("online");
      expect(device?.paired).toBe(true);
      expect(device?.tokenRef).toBeDefined();
    });

    it("should fetch assigned manifest using the authenticated synthetic terminal token", async () => {
      expect(syntheticToken).toBeTruthy();

      const response = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/devices/manifest",
        headers: {
          authorization: `Bearer ${syntheticToken}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.deviceId).toBe("SYNTHETIC-PROBE-TERMINAL");
      expect(body.data.organizationId).toBe(testOrg._id.toString());
      expect(Array.isArray(body.data.journeys)).toBe(true);
      expect(body.data.launchMode).toBeDefined();
    });
  });

  // =========================================================================
  // Requirement 3: Sample Step Asset Delivery
  // =========================================================================
  describe("Sample Step Asset Delivery", () => {
    it("should serve sample step asset via GET /api/v1/kiosk/health/synthetic/sample-asset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/health/synthetic/sample-asset"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.body).toContain("<svg");
      expect(response.body).toContain("Talnova Kiosk Synthetic Asset");
    });

    it("should serve sample step asset via GET /api/v1/kiosk/uploads/sample-asset", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/kiosk/uploads/sample-asset"
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("image/svg+xml");
      expect(response.body).toContain("<svg");
    });
  });

  // =========================================================================
  // Requirement 4 & 5: End-to-End Synthetic Probe Runner (kiosk-synthetic-probe.ts)
  // =========================================================================
  describe("Synthetic Probe Script Execution (server/src/scripts/kiosk-synthetic-probe.ts)", () => {
    it("should execute all 5 synthetic probe steps and validate total latency < 1000ms", async () => {
      const result = await runSyntheticProbe({
        app,
        organizationId: testOrg._id.toString(),
        deviceId: `SYNTHETIC-PROBE-RUNNER-${ts}`,
        maxLatencyMs: 1000
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("healthy");
      expect(result.totalLatencyMs).toBeLessThan(1000); // SLA verification

      // Verify Step 1: Ping API health
      expect(result.steps.ping.status).toBe("pass");
      expect(result.steps.ping.latencyMs).toBeGreaterThanOrEqual(0);

      // Verify Step 2: Authenticate synthetic terminal
      expect(result.steps.auth.status).toBe("pass");
      expect(result.steps.auth.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.steps.auth.deviceId).toContain("SYNTHETIC-PROBE-RUNNER");

      // Verify Step 3: Fetch assigned manifest
      expect(result.steps.manifest.status).toBe("pass");
      expect(result.steps.manifest.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.steps.manifest.journeyCount).toBeDefined();

      // Verify Step 4: Fetch sample step asset
      expect(result.steps.asset.status).toBe("pass");
      expect(result.steps.asset.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.steps.asset.contentType).toContain("image/svg+xml");

      // Subsystem latencies captured in result
      expect(result.subsystems).toBeDefined();
      expect(result.subsystems?.database).toBeDefined();
      expect(result.subsystems?.storage).toBeDefined();
      expect(result.subsystems?.auth).toBeDefined();
    });

    it("should flag SLA breach when total latency exceeds configured threshold", async () => {
      // Set an impossibly low threshold (e.g. 0.0001ms) to test SLA breach detection
      const result = await runSyntheticProbe({
        app,
        organizationId: testOrg._id.toString(),
        deviceId: `SYNTHETIC-PROBE-BREACH-${ts}`,
        maxLatencyMs: 0.0001
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("degraded");
      expect(result.error).toContain("breached SLA limit");
      expect(result.totalLatencyMs).toBeGreaterThan(0.0001);
    });
  });
});
