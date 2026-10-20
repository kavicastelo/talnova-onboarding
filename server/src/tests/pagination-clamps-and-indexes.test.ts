import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Task from "../modules/tasks/models/task.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import { ensureMultiTenantIndexes } from "../database/indexes.js";

describe("Database Concurrency Defense: Pagination Clamps & Multi-Tenant Shard Indexes", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  const testRunId = `clamp-test-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    testOrg = await Organization.create({
      name: `Pagination Org ${testRunId}`,
      slug: `pagination-org-${testRunId}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-${testRunId}@talnova.test`,
        passwordHash: "dummy_hash_for_test",
        emailVerified: true,
      },
      profile: {
        firstName: "Database",
        lastName: "Admin",
        fullName: "Database Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
      roles: ["admin"],
      tokenVersion: 1,
    });

    // Seed 120 employees in testOrg to test pagination overflow clamping
    const userDocs = [];
    for (let i = 1; i <= 120; i++) {
      userDocs.push({
        organizationId: testOrg._id,
        auth: {
          email: `worker-${i}-${testRunId}@talnova.test`,
          passwordHash: "dummy_hash",
        },
        profile: {
          firstName: `Worker${i}`,
          lastName: `Batch${i}`,
          fullName: `Worker ${i}`,
        },
        employment: {
          status: "active",
          employeeId: `EMP-${testRunId}-${i}`,
        },
        permissions: {
          role: "employee",
        },
      });
    }
    await User.insertMany(userDocs);
  });

  afterAll(async () => {
    await Organization.deleteMany({ _id: testOrg._id });
    await User.deleteMany({ organizationId: testOrg._id });
    await Task.deleteMany({ organizationId: testOrg._id });
    await Journey.deleteMany({ organizationId: testOrg._id });
    await app.close();
  });

  it("1. Strict Pagination Clamp: GET /api/v1/employees?limit=5000 clamps to 100", async () => {
    const memBefore = process.memoryUsage().heapUsed;

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/employees?limit=5000",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    const memAfter = process.memoryUsage().heapUsed;

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.meta.limit).toBe(100);
    expect(body.data.length).toBeLessThanOrEqual(100);
    expect(body.data.length).toBe(100);

    // Verify heap growth remains flat and bounded
    const heapDiffMb = (memAfter - memBefore) / (1024 * 1024);
    expect(heapDiffMb).toBeLessThan(50); // Under 50MB delta for a clamped request
  });

  it("2. Default Pagination Limit: GET /api/v1/employees defaults to 20", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/employees",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.meta.limit).toBe(20);
    expect(body.data.length).toBe(20);
  });

  it("3. Minimum Pagination Bound: GET /api/v1/employees?limit=-10 clamps to at least 1", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/employees?limit=-10",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.limit).toBeGreaterThanOrEqual(1);
    expect(body.meta.limit).toBeLessThanOrEqual(100);
  });

  it("4. Strict Pagination Clamp: GET /api/v1/journeys?limit=5000 clamps to 100", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/journeys?limit=5000",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.limit).toBe(100);
  });

  it("5. Strict Pagination Clamp: GET /api/v1/tasks?limit=5000 clamps to 100", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/tasks?limit=5000",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.meta.limit).toBe(100);
  });

  it("6. Verify lean POJO output (no Mongoose Document overhead) on employee queries", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/employees?limit=5",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const firstEmp = body.data[0];
    expect(firstEmp).toBeDefined();
    // Excluded fields should not be returned in list queries
    expect(firstEmp.auth?.passwordHash).toBeUndefined();
    expect(firstEmp.security).toBeUndefined();
  });

  it("7. Multi-Tenant Compound Shard Indexes are verified across all high-traffic collections", async () => {
    await ensureMultiTenantIndexes();

    const [userIndexes, taskIndexes, journeyIndexes, auditIndexes] = await Promise.all([
      User.collection.indexes(),
      Task.collection.indexes(),
      Journey.collection.indexes(),
      AuditLog.collection.indexes(),
    ]);

    // Check User compound index: { organizationId: 1, "employment.status": 1, "profile.lastName": 1 }
    const userCompound = userIndexes.some((idx) => {
      const keys = Object.keys(idx.key || {});
      return (
        keys[0] === "organizationId" &&
        idx.key["employment.status"] === 1 &&
        idx.key["profile.lastName"] === 1
      );
    });
    expect(userCompound).toBe(true);

    // Check Task compound index: { organizationId: 1, status: 1, dueDate: 1 }
    const taskCompound = taskIndexes.some((idx) => {
      const keys = Object.keys(idx.key || {});
      return keys[0] === "organizationId" && idx.key.status === 1 && idx.key.dueDate === 1;
    });
    expect(taskCompound).toBe(true);

    // Check Journey compound index: { organizationId: 1, "publishing.status": 1 }
    const journeyCompound = journeyIndexes.some((idx) => {
      const keys = Object.keys(idx.key || {});
      return keys[0] === "organizationId" && idx.key["publishing.status"] === 1;
    });
    expect(journeyCompound).toBe(true);

    // Check AuditLog compound index: { organizationId: 1, createdAt: -1 }
    const auditCompound = auditIndexes.some((idx) => {
      const keys = Object.keys(idx.key || {});
      return keys[0] === "organizationId" && idx.key.createdAt === -1;
    });
    expect(auditCompound).toBe(true);
  });
});
