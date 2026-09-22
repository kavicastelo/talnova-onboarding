import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";

describe("Multi-Role RBAC & Employee Directory Management Integration Tests", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let targetEmployee: any;
  const ts = Date.now();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Acme MultiRole Corp ${ts}`,
      slug: `acme-multirole-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
      departments: [
        { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
        { _id: new mongoose.Types.ObjectId(), name: "Human Resources", active: true },
      ],
    });

    // 2. Create Admin user
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-mr-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Admin",
        lastName: "Boss",
        fullName: "Admin Boss",
      },
      permissions: {
        role: "admin",
        roles: ["admin", "hr_admin", "it_admin"],
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
      roles: ["admin", "hr_admin", "it_admin"],
    });

    // 3. Create target employee
    targetEmployee = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `target-emp-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Target",
        lastName: "Worker",
        fullName: "Target Worker",
      },
      permissions: {
        role: "employee",
        roles: ["employee"],
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
  });

  it("Test 1: Admin can promote/demote and assign multi-role privileges to an employee", async () => {
    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/employees/${targetEmployee._id}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        role: "hr_admin",
        roles: ["hr_admin", "it_admin", "manager"],
        designation: "Head of People Operations & IT Lead",
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = JSON.parse(patchRes.body);
    expect(body.success).toBe(true);

    // Verify database document
    const updatedUser = await User.findById(targetEmployee._id);
    expect(updatedUser?.permissions.role).toBe("hr_admin");
    expect(updatedUser?.permissions.roles).toEqual(
      expect.arrayContaining(["hr_admin", "it_admin", "manager"])
    );
    expect(updatedUser?.employment?.designation).toBe("Head of People Operations & IT Lead");
  });

  it("Test 2: Multi-Role authorization in requireRole middleware", async () => {
    // User with primary role 'employee' but secondary role 'hr_admin'
    const multiRoleUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `hybrid-user-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Hybrid",
        lastName: "Admin",
        fullName: "Hybrid Admin",
      },
      permissions: {
        role: "employee",
        roles: ["employee", "hr_admin"],
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    const multiRoleToken = app.jwt.sign({
      userId: multiRoleUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
      roles: ["employee", "hr_admin"],
    });

    // An employee-directory endpoint protected by requireRole(["owner", "admin", "hr_admin"])
    // Employee list endpoint: GET /api/v1/employees
    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/employees",
      headers: {
        authorization: `Bearer ${multiRoleToken}`,
      },
    });

    // Should succeed because user has 'hr_admin' in their roles!
    expect(getRes.statusCode).toBe(200);
  });

  it("Test 3: Bulk import with multi-roles persists roles array correctly", async () => {
    const importRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        users: [
          {
            email: `bulk-multirole-${ts}@test.com`,
            fullName: "Bulk MultiRole Person",
            role: "it_admin",
            roles: ["it_admin", "manager"],
            department: "Engineering",
          },
        ],
        options: {
          sendInvites: false,
          triggerWorkflows: false,
          autoAssignRoleChecklists: false,
        },
      },
    });

    expect(importRes.statusCode).toBe(200);
    const createdUser = await User.findOne({
      organizationId: testOrg._id,
      "auth.email": `bulk-multirole-${ts}@test.com`,
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser?.permissions.role).toBe("it_admin");
    expect(createdUser?.permissions.roles).toEqual(
      expect.arrayContaining(["it_admin", "manager"])
    );
  });

  it("Test 4: Pure employee token without admin/hr roles is denied access to employee invite", async () => {
    const pureEmployee = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `pure-emp-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Pure",
        lastName: "Emp",
        fullName: "Pure Emp",
      },
      permissions: {
        role: "employee",
        roles: ["employee"],
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    const pureEmployeeToken = app.jwt.sign({
      userId: pureEmployee._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
      roles: ["employee"],
    });

    const inviteRes = await app.inject({
      method: "POST",
      url: "/api/v1/employees/invite",
      headers: {
        authorization: `Bearer ${pureEmployeeToken}`,
      },
      payload: {
        email: `forbidden-invite-${ts}@test.com`,
        firstName: "Forbidden",
        lastName: "Invite",
        role: "employee",
        employmentType: "full_time",
      },
    });

    expect(inviteRes.statusCode).toBe(403);
  });
});
