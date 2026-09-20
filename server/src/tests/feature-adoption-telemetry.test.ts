import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { FeatureUsageRecord } from "../modules/super-admin/models/feature-usage-record.model.js";
import { FeatureTelemetryService } from "../modules/super-admin/services/feature-telemetry.service.js";

describe("PR-TEL-001: Feature Adoption Telemetry Pipeline & Rollup Engine", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let superAdminToken: string;
  let regularUserToken: string;

  const testPrefix = `tel-${Date.now()}`;
  const testOrgs: any[] = [];
  const totalOrgsToCreate = 5;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyCreatorId = new mongoose.Types.ObjectId();

    // 1. Create 5 active organizations
    for (let i = 1; i <= totalOrgsToCreate; i++) {
      const org = await Organization.create({
        name: `Telemetry Org ${i} ${testPrefix}`,
        slug: `telemetry-org-${i}-${testPrefix}`,
        plan: "Enterprise",
        status: "Active",
        createdBy: dummyCreatorId,
        isDeleted: false,
      });
      testOrgs.push(org);
    }

    // 2. Create Super Admin user in testOrgs[0]
    superAdminUser = await User.create({
      organizationId: testOrgs[0]._id,
      auth: {
        email: `superadmin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
      },
      employment: {
        department: "Operations",
        jobTitle: "Super Administrator",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: testOrgs[0]._id.toString(),
      role: "super_admin",
    });

    // 3. Create regular employee user in testOrgs[0]
    regularUser = await User.create({
      organizationId: testOrgs[0]._id,
      auth: {
        email: `employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Employee",
        fullName: "Regular Employee",
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

    regularUserToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      organizationId: testOrgs[0]._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    const orgIds = testOrgs.map((o) => o._id);
    await FeatureUsageRecord.deleteMany({ organizationId: { $in: orgIds } });
    await User.deleteMany({ organizationId: { $in: orgIds } });
    await Organization.deleteMany({ _id: { $in: orgIds } });
  });

  it("Step 1: Record 10 usage events for digital_signatures across 3 organizations", async () => {
    // Distribute 10 events across first 3 organizations:
    // Org 0: 4 events
    // Org 1: 3 events
    // Org 2: 3 events
    // (Org 3 and Org 4 have 0 events)
    const distribution = [
      { orgIndex: 0, count: 4 },
      { orgIndex: 1, count: 3 },
      { orgIndex: 2, count: 3 },
    ];

    for (const dist of distribution) {
      const org = testOrgs[dist.orgIndex];
      for (let j = 0; j < dist.count; j++) {
        await FeatureTelemetryService.recordUsage({
          featureKey: "digital_signatures",
          organizationId: org._id,
          userId: superAdminUser._id,
          userRole: "employee",
          actionName: "EXECUTE_SIGNATURE",
          metadata: {
            documentId: `doc-${dist.orgIndex}-${j}`,
            testRun: testPrefix,
          },
        });
      }
    }

    const recordedCount = await FeatureUsageRecord.countDocuments({
      featureKey: "digital_signatures",
      organizationId: { $in: [testOrgs[0]._id, testOrgs[1]._id, testOrgs[2]._id] },
    });

    expect(recordedCount).toBe(10);
  });

  it("Step 2 & 3 & 4: Query GET /api/v1/super-admin/analytics/feature-adoption and assert activeTenants and adoptionPct", async () => {
    const totalActiveOrgsInDb = await Organization.countDocuments({ isDeleted: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/analytics/feature-adoption",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const data = body.data;
    expect(data).toBeDefined();

    // Find the digital_signatures feature entry
    const sigFeature = data.features.find((f: any) => f.featureKey === "digital_signatures");
    expect(sigFeature).toBeDefined();

    // 3. Assert activeTenants equals 3
    expect(sigFeature.activeTenants).toBe(3);
    expect(sigFeature.activeTenantsCount).toBe(3);
    expect(sigFeature.totalUsageEvents).toBe(10);

    // 4. Assert adoptionPct mathematically matches (3 / totalOrgs) * 100
    const expectedAdoptionPct = Math.round((3 / totalActiveOrgsInDb) * 10000) / 100;
    expect(sigFeature.adoptionPct).toBeCloseTo(expectedAdoptionPct, 1);
    expect(sigFeature.orgAdoptionPct).toBeCloseTo(expectedAdoptionPct, 1);

    // Also assert top-level accessors if present
    if (data.digital_signatures) {
      expect(data.digital_signatures.activeTenants).toBe(3);
      expect(data.digital_signatures.adoptionPct).toBeCloseTo(expectedAdoptionPct, 1);
    }
  });

  it("Step 5: Filter feature adoption by specific featureKey query param", async () => {
    const totalActiveOrgsInDb = await Organization.countDocuments({ isDeleted: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/analytics/feature-adoption?featureKey=digital_signatures",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    const data = body.data;

    expect(data.activeTenants).toBe(3);
    expect(data.totalUsageEvents).toBe(10);
    const expectedAdoptionPct = Math.round((3 / totalActiveOrgsInDb) * 10000) / 100;
    expect(data.adoptionPct).toBeCloseTo(expectedAdoptionPct, 1);
  });

  it("Security check: Non-super-admin user receives 403 Forbidden", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/analytics/feature-adoption",
      headers: {
        authorization: `Bearer ${regularUserToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Security check: Unauthenticated call receives 401 Unauthorized", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/analytics/feature-adoption",
    });

    expect(response.statusCode).toBe(401);
  });

  it("Fail-safe test: Malformed or failing telemetry recordUsage never throws", async () => {
    // Pass null/empty or invalid objects
    await expect(FeatureTelemetryService.recordUsage(null as any)).resolves.not.toThrow();
    await expect(
      FeatureTelemetryService.recordUsage({
        featureKey: "",
        organizationId: "not-an-id" as any,
        actionName: "FAIL_TEST",
      })
    ).resolves.not.toThrow();
  });

  it("PII stripping test: Disallowed sensitive metadata keys are scrubbed", async () => {
    await FeatureTelemetryService.recordUsage({
      featureKey: "pii_scrub_test",
      organizationId: testOrgs[0]._id,
      userId: superAdminUser._id,
      actionName: "TEST_PII_SCRUB",
      metadata: {
        safeField: "safe_value",
        password: "SuperSecretPassword123!",
        token: "jwt_raw_secret_token",
        ssn: "000-11-2222",
        email: "leak@victim.com",
      },
    });

    const record = await FeatureUsageRecord.findOne({
      featureKey: "pii_scrub_test",
      organizationId: testOrgs[0]._id,
    });

    expect(record).toBeDefined();
    expect(record?.metadata?.safeField).toBe("safe_value");
    expect(record?.metadata?.password).toBeUndefined();
    expect(record?.metadata?.token).toBeUndefined();
    expect(record?.metadata?.ssn).toBeUndefined();
    expect(record?.metadata?.email).toBeUndefined();

    // Clean up
    await FeatureUsageRecord.deleteOne({ _id: record?._id });
  });

  it("Domain workflow instrumentation: Kiosk session route emits kiosk_mode telemetry", async () => {
    const sessionResponse = await app.inject({
      method: "GET",
      url: `/api/v1/kiosk/sessions/sess-${testPrefix}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(sessionResponse.statusCode).toBe(200);

    const kioskRecord = await FeatureUsageRecord.findOne({
      featureKey: "kiosk_mode",
      organizationId: testOrgs[0]._id,
    });

    expect(kioskRecord).toBeDefined();
    expect(kioskRecord?.actionName).toBe("GET_KIOSK_SESSION");
  });
});
