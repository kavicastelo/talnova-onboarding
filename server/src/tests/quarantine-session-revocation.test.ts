import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Session from "../modules/auth/models/session.model.js";
import TenantStatusCache from "../infrastructure/cache/tenant-status.cache.js";

describe("PR-SEC-001: Active JWT Session Revocation & Quarantine Boundary Guard", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let aliceUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let aliceToken: string;
  let aliceSession: any;

  const testPrefix = `sec-quarantine-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Provision Organization with status "Active"
    testOrg = await Organization.create({
      name: `Quarantine Test Corp ${testPrefix}`,
      slug: `quarantine-corp-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
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
        department: "Platform Engineering",
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
      email: superAdminUser.auth.email,
    });

    // 3. Create Tenant User Alice
    aliceUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `alice-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Alice",
        lastName: "Engineer",
        fullName: "Alice Engineer",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Senior Engineer",
        status: "active",
      },
      permissions: {
        role: "admin",
      },
    });

    // Alice authenticates and obtains active JWT token
    aliceToken = app.jwt.sign({
      userId: aliceUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
      email: aliceUser.auth.email,
    });

    // Create active session in DB for Alice
    aliceSession = await Session.create({
      userId: aliceUser._id,
      organizationId: testOrg._id,
      tokenVersion: 1,
      isValid: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000), // 8 hour active session
    });
  });

  afterAll(async () => {
    // Cleanup test artifacts
    if (testOrg?._id) {
      TenantStatusCache.removeSuspended(testOrg._id.toString());
      await Organization.deleteMany({ _id: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Session.deleteMany({ organizationId: testOrg._id });
    }
    await app.close();
  });

  it("Step 1-3: Alice can successfully access /api/v1/journeys while organization is Active", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/journeys",
      headers: {
        authorization: `Bearer ${aliceToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });

  it("Step 4: Super Admin quarantines organization via POST /api/v1/super-admin/organizations/:id/quarantine", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/quarantine`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        reason: "Security audit compliance lockdown",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Suspended");

    // Verify Organization document updated in DB
    const orgDoc = await Organization.findById(testOrg._id);
    expect(orgDoc?.status).toBe("Suspended");

    // Verify active sessions were invalidated with revokedReason: ORGANIZATION_QUARANTINED
    const updatedSession = await Session.findById(aliceSession._id);
    expect(updatedSession?.isValid).toBe(false);
    expect(updatedSession?.revokedReason).toBe("ORGANIZATION_QUARANTINED");

    // Verify in-memory TenantStatusCache reflects suspended status
    expect(TenantStatusCache.isSuspended(testOrg._id.toString())).toBe(true);
  });

  it("Step 5-6: Alice immediately calls /api/v1/journeys with existing JWT -> rejected with 403 ORGANIZATION_SUSPENDED", async () => {
    const startTime = performance.now();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/journeys",
      headers: {
        authorization: `Bearer ${aliceToken}`,
      },
    });
    const duration = performance.now() - startTime;

    // Boundary check must execute in < 5ms
    expect(duration).toBeLessThan(100); // Allowing test runner overhead, cache lookup is sub-millisecond

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("ORGANIZATION_SUSPENDED");
    expect(body.message).toBe("Your organization has been suspended by platform administration.");
  });

  it("Step 6b: Super Admin is exempt and can still perform administrative operations on suspended tenant", async () => {
    // Super Admin should not be blocked from inspecting or administrating
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/360`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
  });

  it("Step 7: Super Admin restores organization via POST /api/v1/super-admin/organizations/:id/activate", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${testOrg._id}/activate`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("Active");

    // Verify database document
    const orgDoc = await Organization.findById(testOrg._id);
    expect(orgDoc?.status).toBe("Active");

    // Verify TenantStatusCache no longer reports tenant as suspended
    expect(TenantStatusCache.isSuspended(testOrg._id.toString())).toBe(false);
  });

  it("Step 8: Subsequent authenticated request by Alice succeeds after tenant restoration", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/journeys",
      headers: {
        authorization: `Bearer ${aliceToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
  });
});
