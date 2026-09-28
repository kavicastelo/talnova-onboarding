import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import OrganizationIntegration from "../modules/integrations/models/organization-integration.model.js";
import { SystemLogBuffer } from "../infrastructure/telemetry/system-log-buffer.js";
import { UploadService } from "../modules/uploads/services/upload.service.js";
import { UploadRepository } from "../modules/uploads/repositories/upload.repository.js";
import { SuperAdminService } from "../modules/super-admin/services/super-admin.service.js";

describe("Super Admin Platform Observability Suite", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let superAdminService: SuperAdminService;

  const testPrefix = `obs-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    superAdminService = new SuperAdminService();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization with 5 GB storage limit
    testOrg = await Organization.create({
      name: `Observability Corp ${testPrefix}`,
      slug: `obs-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
      limits: {
        maxUsers: 100,
        maxJourneys: 20,
        maxStorageGb: 5,
      },
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `obs-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin Observability",
      },
      employment: {
        department: "Operations",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: "super_admin",
      organizationId: testOrg._id.toString(),
    });

    // 3. Create dummy BYOK integration for testOrg
    await OrganizationIntegration.create({
      organizationId: testOrg._id,
      type: "ai",
      provider: "openai",
      status: "valid",
      enabled: true,
      createdBy: dummyId,
      publicConfig: {
        model: "gpt-4o",
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await Organization.deleteOne({ _id: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await OrganizationIntegration.deleteMany({ organizationId: testOrg._id });
    }
    await app.close();
    await mongoose.disconnect();
  });

  // ---------------------------------------------------------------------------
  // 1. SystemLogBuffer In-Memory Streaming
  // ---------------------------------------------------------------------------
  it("SystemLogBuffer records runtime logs and supports query filtering", () => {
    const testLogMsg = `Test runtime log entry ${testPrefix}`;
    SystemLogBuffer.record({
      level: "warning",
      source: "storage",
      eventType: "STORAGE_ALERT",
      message: testLogMsg,
      organizationId: testOrg._id.toString(),
      metadata: { usedGb: 4.8, maxGb: 5 },
    });

    const recentLogs = SystemLogBuffer.getLogs(50);
    const found = recentLogs.find((l) => l.message === testLogMsg);

    expect(found).toBeDefined();
    expect(found?.level).toBe("warning");
    expect(found?.source).toBe("storage");
    expect(found?.organizationId).toBe(testOrg._id.toString());

    // Filter by source
    const filtered = SystemLogBuffer.getLogs(50, { source: "storage" });
    expect(filtered.some((l) => l.message === testLogMsg)).toBe(true);

    // Filter by severity critical (should not include warning)
    const errorLogs = SystemLogBuffer.getLogs(50, { severity: "critical" });
    expect(errorLogs.some((l) => l.message === testLogMsg)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // 2. Storage Quota Enforcement
  // ---------------------------------------------------------------------------
  it("UploadService enforces tenant maxStorageGb quota limit", async () => {
    const uploadRepo = new UploadRepository();
    const uploadService = new UploadService(uploadRepo);

    // Mock uploadRepo.getTotalStorageBytes to return 4.9 GB
    const usedBytesMock = 4.9 * 1024 * 1024 * 1024;
    const originalGetTotal = uploadRepo.getTotalStorageBytes;
    uploadRepo.getTotalStorageBytes = async () => usedBytesMock;

    // A 200 MB file should exceed 5 GB quota (4.9 GB + 0.2 GB = 5.1 GB > 5.0 GB)
    const fileBytes = 200 * 1024 * 1024;

    await expect(
      uploadService.requestUploadUrl(
        testOrg._id.toString(),
        superAdminUser._id.toString(),
        {
          fileName: "huge-archive.zip",
          mimeType: "application/zip",
          fileSizeBytes: fileBytes,
        }
      )
    ).rejects.toMatchObject({
      statusCode: 413,
      message: expect.stringMatching(/storage quota exceeded/i),
    });

    // Restore method
    uploadRepo.getTotalStorageBytes = originalGetTotal;
  });

  // ---------------------------------------------------------------------------
  // 3. Super Admin Storage Limit Adjustment Route
  // ---------------------------------------------------------------------------
  it("PATCH /api/v1/super-admin/organizations/:id/storage-limit updates quota", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/storage-limit`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        maxStorageGb: 25,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.maxStorageGb).toBe(25);

    // Verify DB update
    const updated = await Organization.findById(testOrg._id);
    expect(updated?.limits?.maxStorageGb).toBe(25);
  });

  // ---------------------------------------------------------------------------
  // 4. AI Observability Multi-Tenant BYOK
  // ---------------------------------------------------------------------------
  it("getAiObservability returns BYOK integrations and provider counts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/observability/ai?organizationId=${testOrg._id}`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("providerCounts");
    expect(body.data.providerCounts.openai).toBeGreaterThanOrEqual(1);
    expect(body.data).toHaveProperty("byOrganization");
    expect(Array.isArray(body.data.byOrganization)).toBe(true);

    const orgRow = body.data.byOrganization.find(
      (o: any) => o.organizationId === testOrg._id.toString()
    );
    expect(orgRow).toBeDefined();
    expect(orgRow.provider).toBe("openai");
    expect(orgRow.hasByok).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // 5. Storage Observability Multi-Tenant Breakdown
  // ---------------------------------------------------------------------------
  it("getStorageObservability returns per-organization storage limits and usage", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/observability/storage",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("byOrganization");
    expect(Array.isArray(body.data.byOrganization)).toBe(true);

    const orgStorage = body.data.byOrganization.find(
      (o: any) => o.organizationId === testOrg._id.toString()
    );
    expect(orgStorage).toBeDefined();
    expect(orgStorage.maxStorageGb).toBe(25); // from test 3 update
    expect(orgStorage.percentUsed).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 6. Infrastructure Observability
  // ---------------------------------------------------------------------------
  it("getInfrastructureObservability returns DB roundtrip ping and demo db status", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/observability/infrastructure",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.database).toBeDefined();
    expect(body.data.database.state).toBe("CONNECTED");
    expect(body.data.database.pingMs).toBeGreaterThanOrEqual(0);
    expect(body.data.demoDatabase).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 7. Activity Explorer Category Aliasing & Streaming
  // ---------------------------------------------------------------------------
  it("getActivity properly normalizes category queries", async () => {
    // Test category "tenant" aliasing
    const resTenant = await superAdminService.getActivity({ category: "tenant" });
    expect(resTenant).toHaveProperty("events");
    expect(resTenant).toHaveProperty("summary");

    // Test category "system" merges SystemLogBuffer entries
    const resSystem = await superAdminService.getActivity({ category: "system" });
    expect(resSystem.events.length).toBeGreaterThanOrEqual(1);
    expect(resSystem.events.some((e: any) => e.category === "system")).toBe(true);
  });
});
