import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { AuditLog } from "../modules/audit-logs/models/audit-log.model.js";
import { hashPassword } from "../utils/crypto.js";

describe("Super Admin: Sudo Mode & Destructive Action Safeguards", () => {
  let app: FastifyInstance;
  let rootOrg: any;
  let superAdminUser: any;
  let superAdminToken: string;
  const adminPassword = "SuperAdminSecretP@ssw0rd!2026";
  const testRunId = `sudo-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    rootOrg = await Organization.create({
      name: `Sudo Test Org ${testRunId}`,
      slug: `sudo-test-${testRunId}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    const hashedPassword = await hashPassword(adminPassword);

    superAdminUser = await User.create({
      organizationId: rootOrg._id,
      auth: {
        email: `sudo-admin-${testRunId}@talnova.test`,
        passwordHash: hashedPassword,
        emailVerified: true,
      },
      profile: {
        firstName: "Sudo",
        lastName: "Admin",
        fullName: "Sudo Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        roles: ["super_admin"],
      },
      security: {
        mfaEnabled: false,
        failedLoginAttempts: 0,
        // Initially no sudo verification
        lastSudoVerifiedAt: undefined,
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: rootOrg._id.toString(),
      role: "super_admin",
      roles: ["super_admin"],
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ slug: { $regex: testRunId } });
    await User.deleteMany({ "auth.email": { $regex: testRunId } });
    await AuditLog.deleteMany({ actorUserId: superAdminUser._id });
    await app.close();
  });

  it("1. Block unverified access to POST /database-storage/purge with SUDO_CONFIRMATION_REQUIRED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/observability/database-storage/purge",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        manifestId: "test-manifest-123",
        confirmationText: "PURGE_NOW",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("SUDO_CONFIRMATION_REQUIRED");
    expect(body.message).toContain("High-risk administrative action requires recent sudo confirmation");
  });

  it("2. Block unverified access to DELETE /organizations/:id with SUDO_CONFIRMATION_REQUIRED", async () => {
    const dummyOrgId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/organizations/${dummyOrgId}?mode=soft`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("SUDO_CONFIRMATION_REQUIRED");
  });

  it("3. Block unverified access to POST /database-storage/restore with SUDO_CONFIRMATION_REQUIRED", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/observability/database-storage/restore",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        manifestId: "test-manifest-123",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("SUDO_CONFIRMATION_REQUIRED");
  });

  it("4. Block unverified access to GET /database-storage/backups/:manifestId/download with SUDO_CONFIRMATION_REQUIRED", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/observability/database-storage/backups/test-manifest-123/download",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe("SUDO_CONFIRMATION_REQUIRED");
  });

  it("5. Check sudo status when not verified: returns isActive: false", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/sudo/status",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.isActive).toBe(false);
    expect(body.data.remainingSeconds).toBe(0);
  });

  it("6. Sudo verification with wrong password returns 401 and records audit log", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/sudo/verify",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        password: "IncorrectPassword123!",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = res.json();
    expect(body.code).toBe("INVALID_CREDENTIALS");

    // Verify audit log for failed sudo attempt
    const failedLog = await AuditLog.findOne({
      actorUserId: superAdminUser._id,
      eventType: "SUDO_VERIFICATION_FAILED",
    });
    expect(failedLog).toBeDefined();
    expect(failedLog?.eventCategory).toBe("security");
  });

  it("7. Sudo verification with correct password activates sudo mode for 15 minutes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/sudo/verify",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        "user-agent": "TalnovaSecurityTestRunner/2.0",
      },
      payload: {
        password: adminPassword,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.verified).toBe(true);
    expect(body.data.expiresInSeconds).toBe(900);

    // Verify user document in DB was updated
    const updatedUser = await User.findById(superAdminUser._id);
    expect(updatedUser?.security?.lastSudoVerifiedAt).toBeDefined();

    // Verify audit log for successful sudo elevation
    const successLog = await AuditLog.findOne({
      actorUserId: superAdminUser._id,
      eventType: "SUDO_VERIFICATION_SUCCESS",
    });
    expect(successLog).toBeDefined();
    expect(successLog?.eventCategory).toBe("security");
  });

  it("8. Check sudo status after elevation: returns isActive: true and > 0 remainingSeconds", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/sudo/status",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.isActive).toBe(true);
    expect(body.data.remainingSeconds).toBeGreaterThan(800);
  });

  it("9. Sudo-verified super admin can execute DELETE /organizations/:id with immutable audit log", async () => {
    // Create a target organization to delete
    const targetOrg = await Organization.create({
      name: `Target Org for Sudo Delete ${testRunId}`,
      slug: `target-sudo-${testRunId}`,
      plan: "Starter",
      status: "Active",
      createdBy: superAdminUser._id,
      isDeleted: false,
    });

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/organizations/${targetOrg._id}?mode=soft`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        "user-agent": "TalnovaSecurityAuditAgent/1.0",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.organization.isDeleted).toBe(true);

    // Verify immutable audit log contains actor IP, user agent, target collection, and change summary
    const auditEntry = await AuditLog.findOne({
      actorUserId: superAdminUser._id,
      eventType: "ORGANIZATION_ARCHIVED",
      resourceId: targetOrg._id,
    });

    expect(auditEntry).toBeDefined();
    expect(auditEntry?.request?.userAgent).toBe("TalnovaSecurityAuditAgent/1.0");
    expect(auditEntry?.metadata?.targetCollection).toBe("organizations");
    expect(auditEntry?.metadata?.changeSummary).toContain("was archived (soft-deleted)");
    expect(auditEntry?.metadata?.sudoConfirmed).toBe(true);
  });

  it("10. Expired sudo (>15m) re-blocks protected endpoints with SUDO_CONFIRMATION_REQUIRED", async () => {
    // Manually backdate lastSudoVerifiedAt to 16 minutes ago
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    await User.updateOne(
      { _id: superAdminUser._id },
      { $set: { "security.lastSudoVerifiedAt": sixteenMinutesAgo } }
    );

    // Check status
    const statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/sudo/status",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });
    expect(statusRes.json().data.isActive).toBe(false);

    // Attempt calling purge: must be blocked
    const purgeRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/observability/database-storage/purge",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        manifestId: "test-manifest-123",
        confirmationText: "PURGE_NOW",
      },
    });

    expect(purgeRes.statusCode).toBe(403);
    expect(purgeRes.json().code).toBe("SUDO_CONFIRMATION_REQUIRED");
  });
});
