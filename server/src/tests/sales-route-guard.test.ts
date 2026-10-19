import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";

describe("FOUND-002: Fastify Sales Route Registration & RBAC Guard", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let tenantUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let tenantToken: string;

  const testPrefix = `sales-guard-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Sales Guard Org ${testPrefix}`,
      slug: `sales-guard-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sales-superadmin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Sales",
        lastName: "SuperAdmin",
        fullName: "Sales SuperAdmin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        customRoles: [],
      },
    });
    createdUserIds.push(superAdminUser._id);

    tenantUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sales-tenant-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Tenant",
        lastName: "User",
        fullName: "Tenant User",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "employee",
        customRoles: [],
      },
    });
    createdUserIds.push(tenantUser._id);

    superAdminToken = app.jwt.sign({
      id: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    tenantToken = app.jwt.sign({
      id: tenantUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDatabase(app.log);
    await app.close();
  });

  it("should reject unauthenticated request to /api/v1/sales/ping with 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sales/ping",
    });

    expect(res.statusCode).toBe(401);
  });

  it("should reject non-super_admin user request to /api/v1/sales/ping with 403 Forbidden", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sales/ping",
      headers: {
        authorization: `Bearer ${tenantToken}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("should allow super_admin access to /api/v1/sales/ping with 200 OK", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sales/ping",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(body.module).toBe("sales");
  });
});
