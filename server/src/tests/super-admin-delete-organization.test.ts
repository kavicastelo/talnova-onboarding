import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Session from "../modules/auth/models/session.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import Task from "../modules/tasks/models/task.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";

describe("Super Admin: Dual-Mode Organization Deletion & GDPR Cascade Purge", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let rootOrg: any;
  let superAdminToken: string;
  let employeeToken: string;

  const testRunId = `del-org-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    rootOrg = await Organization.create({
      name: `Root Cluster ${testRunId}`,
      slug: `root-${testRunId}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    superAdminUser = await User.create({
      organizationId: rootOrg._id,
      auth: {
        email: `root-${testRunId}@talnova.test`,
        passwordHash: "dummy_hash_for_test",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        roles: ["super_admin"],
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: rootOrg._id.toString(),
      role: "super_admin",
      roles: ["super_admin"],
      tokenVersion: 1,
    });

    employeeToken = app.jwt.sign({
      userId: new mongoose.Types.ObjectId().toString(),
      organizationId: rootOrg._id.toString(),
      role: "employee",
      roles: ["employee"],
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await Organization.deleteMany({ slug: { $regex: testRunId } });
    await User.deleteMany({ "auth.email": { $regex: testRunId } });
    await app.close();
  });

  it("1. RBAC Guard: Rejects non-super-admin deletion attempt with HTTP 403", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/organizations/any-id?mode=soft`,
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it("2. Soft Delete / Archive: Suspends organization, revokes active sessions, and allows restoration", async () => {
    const slug = `soft-${testRunId}`;
    const org = await Organization.create({
      name: `Soft Delete Org ${testRunId}`,
      slug,
      plan: "Growth",
      status: "Active",
      createdBy: superAdminUser._id,
      isDeleted: false,
    });

    const user = await User.create({
      organizationId: org._id,
      auth: {
        email: `user-soft-${testRunId}@talnova.test`,
        passwordHash: "dummy_pass_hash",
      },
      profile: { firstName: "Jane", lastName: "Doe" },
      employment: { status: "active" },
      permissions: { role: "admin" },
    });

    const session = await Session.create({
      userId: user._id,
      organizationId: org._id,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
      tokenVersion: 1,
    });

    // Execute Soft Delete
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/organizations/${slug}?mode=soft`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteRes.body);
    expect(deleteBody.success).toBe(true);
    expect(deleteBody.data.mode).toBe("soft");

    // Verify DB state after soft delete
    const archivedOrg = await Organization.findById(org._id);
    expect(archivedOrg?.isDeleted).toBe(true);
    expect(archivedOrg?.status).toBe("Suspended");
    expect(archivedOrg?.deletedAt).toBeDefined();

    const revokedSession = await Session.findById(session._id);
    expect(revokedSession?.isValid).toBe(false);

    const suspendedUser = await User.findById(user._id);
    expect(suspendedUser?.employment?.status).toBe("terminated");

    // Execute Restore
    const restoreRes = await app.inject({
      method: "POST",
      url: `/api/v1/super-admin/organizations/${slug}/restore`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(restoreRes.statusCode).toBe(200);
    const restoreBody = JSON.parse(restoreRes.body);
    expect(restoreBody.success).toBe(true);

    // Verify DB state after restore
    const restoredOrg = await Organization.findById(org._id);
    expect(restoredOrg?.isDeleted).toBe(false);
    expect(restoredOrg?.status).toBe("Active");
  });

  it("3. Permanent Hard Purge: Cascade deletes organization and all associated records across collections", async () => {
    const slug = `purge-${testRunId}`;
    const org = await Organization.create({
      name: `Hard Purge Org ${testRunId}`,
      slug,
      plan: "Enterprise",
      status: "Active",
      createdBy: superAdminUser._id,
      isDeleted: false,
    });

    const orgId = org._id;

    // Seed associated data across multiple collections
    const user = await User.create({
      organizationId: orgId,
      auth: {
        email: `purge-user-${testRunId}@talnova.test`,
        passwordHash: "dummy_pass_hash",
      },
      profile: { firstName: "Hard", lastName: "Purge" },
      employment: { status: "active" },
      permissions: { role: "owner" },
    });

    await Session.create({
      userId: user._id,
      organizationId: orgId,
      isValid: true,
      expiresAt: new Date(Date.now() + 86400000),
      tokenVersion: 1,
    });

    await Journey.create({
      organizationId: orgId,
      title: `Onboarding Journey ${testRunId}`,
      slug: `journey-${testRunId}`,
      description: "Comprehensive onboarding journey for test organization.",
      createdBy: user._id,
    });

    await Task.create({
      organizationId: orgId,
      assignedToUserId: user._id,
      createdBy: user._id,
      title: `Complete Profile ${testRunId}`,
      category: "general",
      stage: "day_1",
      priority: "normal",
      status: "pending",
    });

    await Invoice.create({
      organizationId: orgId,
      invoiceNo: `INV-${testRunId}`,
      customerName: "Hard Purge Org",
      amount: 1500,
      totalAmount: 1500,
      dueDate: new Date(Date.now() + 86400000),
      status: "Paid",
      createdBy: superAdminUser._id,
    });

    // Execute Hard Purge
    const purgeRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/super-admin/organizations/${slug}?mode=hard`,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(purgeRes.statusCode).toBe(200);
    const purgeBody = JSON.parse(purgeRes.body);
    expect(purgeBody.success).toBe(true);
    expect(purgeBody.data.mode).toBe("hard");
    expect(purgeBody.data.deletedCounts).toBeDefined();

    // Verify COMPLETE erasure in MongoDB
    const orgCheck = await Organization.findById(orgId);
    expect(orgCheck).toBeNull();

    const userCount = await User.countDocuments({ organizationId: orgId });
    expect(userCount).toBe(0);

    const sessionCount = await Session.countDocuments({ organizationId: orgId });
    expect(sessionCount).toBe(0);

    const journeyCount = await Journey.countDocuments({ organizationId: orgId });
    expect(journeyCount).toBe(0);

    const taskCount = await Task.countDocuments({ organizationId: orgId });
    expect(taskCount).toBe(0);

    const invoiceCount = await Invoice.countDocuments({ organizationId: orgId });
    expect(invoiceCount).toBe(0);
  });
});
