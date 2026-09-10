import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";

describe("Journey Test UJ-ADM-009: Org Branding & Department Settings", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;
  let createdDeptId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Acme Branding Corp ${ts}`,
      slug: `acme-branding-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
      branding: {
        primaryColor: "#000000",
        secondaryColor: "#ffffff",
        accentColor: "#6366f1",
      },
      departments: [
        { _id: new mongoose.Types.ObjectId(), name: "Engineering", code: "ENG", active: true },
        { _id: new mongoose.Types.ObjectId(), name: "Marketing", code: "MKT", active: true },
      ],
    });

    // 2. Create Admin user
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-brand-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Admin",
        lastName: "Owner",
        fullName: "Admin Owner",
      },
      permissions: {
        role: "admin",
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
    });

    // 3. Create regular Employee user
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-brand-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Standard",
        lastName: "Worker",
        fullName: "Standard Worker",
      },
      permissions: {
        role: "employee",
      },
      employment: {
        status: "active",
        employmentType: "full_time",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 3, 4 & 5: PATCH /api/v1/organizations/branding updates primary brand color to #1d4ed8", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/organizations/branding",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        primaryColor: "#1d4ed8",
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.branding.primaryColor).toBe("#1d4ed8");

    // Data Integrity check in MongoDB
    const persistedOrg = await Organization.findById(testOrg._id);
    expect(persistedOrg?.branding.primaryColor).toBe("#1d4ed8");
  });

  it("Step 8, 9, 10 & 11: POST /api/v1/organizations/departments creates Customer Success (CS) department", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "Customer Success",
        code: "CS",
      },
    });

    expect(res.statusCode).toBe(201);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    expect(json.data.name).toBe("Customer Success");
    expect(json.data.code).toBe("CS");
    createdDeptId = json.data._id;
    expect(createdDeptId).toBeTruthy();

    // Data Integrity check in MongoDB
    const persistedOrg = await Organization.findById(testOrg._id);
    const foundDept = persistedOrg?.departments.find(
      (d) => d._id.toString() === createdDeptId.toString()
    );
    expect(foundDept).toBeDefined();
    expect(foundDept?.name).toBe("Customer Success");
    expect(foundDept?.code).toBe("CS");
    expect(foundDept?.active).toBe(true);
  });

  it("Integration Check: GET /api/v1/organizations/departments lists the new department", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.success).toBe(true);
    const csDept = json.data.find((d: any) => d.code === "CS");
    expect(csDept).toBeDefined();
    expect(csDept.name).toBe("Customer Success");
  });

  it("Alternative Path: DELETE /api/v1/organizations/departments/:id deletes empty department", async () => {
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/api/v1/organizations/departments/${createdDeptId}`,
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(deleteRes.statusCode).toBe(200);

    // Verify department is removed
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });
    const json = JSON.parse(listRes.body);
    const csDept = json.data.find((d: any) => d._id === createdDeptId);
    expect(csDept).toBeUndefined();
  });

  it("Negative Tests: Invalid hex color format ('blue') is rejected with 400 Bad Request", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/v1/organizations/branding",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        primaryColor: "blue",
      },
    });

    expect([400, 422]).toContain(res.statusCode);
    const json = JSON.parse(res.body);
  });

  it("Negative Tests: Duplicate department code within tenant is rejected with 400 Bad Request", async () => {
    // Re-create CS department
    await app.inject({
      method: "POST",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "Customer Success",
        code: "CS",
      },
    });

    // Attempt to create another department with duplicate code "CS"
    const duplicateRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: {
        name: "Client Services",
        code: "CS",
      },
    });

    expect(duplicateRes.statusCode).toBe(400);
    const json = JSON.parse(duplicateRes.body);
    expect(json.success).toBe(false);
    expect(json.message).toContain("Department with code 'CS' already exists");
  });

  it("Authorization Tests: Regular employees are rejected with 403 Forbidden", async () => {
    // Employee attempting to update branding
    const brandRes = await app.inject({
      method: "PATCH",
      url: "/api/v1/organizations/branding",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        primaryColor: "#1d4ed8",
      },
    });
    expect(brandRes.statusCode).toBe(403);

    // Employee attempting to create department
    const deptRes = await app.inject({
      method: "POST",
      url: "/api/v1/organizations/departments",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload: {
        name: "Unauthorized Dept",
        code: "UD",
      },
    });
    expect(deptRes.statusCode).toBe(403);
  });
});
