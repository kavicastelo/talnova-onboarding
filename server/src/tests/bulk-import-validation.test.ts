import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { hashPassword } from "../utils/crypto.js";

describe("Automation Prompt 05 — Bulk Import Backend Validation & Manager Hierarchy", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let adminToken: string;
  let managerId: string;
  let managerEmail = "lead.eng@talnova-bulk-test.com";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up previous test artifacts
    await Organization.deleteMany({ slug: "bulk-import-test-org" });

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create test tenant
    const org = await Organization.create({
      name: "Bulk Import Test Organization",
      slug: "bulk-import-test-org",
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      departments: [
        { name: "Engineering", active: true },
        { name: "Product", active: true },
      ],
    });
    testOrgId = org._id.toString();

    // 2. Create Admin user
    const passwordHash = await hashPassword("AdminSecret123!");
    const adminUser = await User.create({
      organizationId: org._id,
      auth: { email: "admin@talnova-bulk-test.com", passwordHash, emailVerified: true },
      profile: { firstName: "Admin", lastName: "Tester", fullName: "Admin Tester" },
      permissions: { role: "admin", customRoles: [] },
      isDeleted: false,
    });

    // 3. Create existing Manager user
    const mgrUser = await User.create({
      organizationId: org._id,
      auth: { email: managerEmail, passwordHash, emailVerified: true },
      profile: { firstName: "Engineering", lastName: "Lead", fullName: "Engineering Lead" },
      employment: { department: "Engineering", employeeId: "MGR-101", status: "active" },
      permissions: { role: "manager", customRoles: [] },
      isDeleted: false,
    });
    managerId = mgrUser._id.toString();

    // 4. Authenticate admin
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@talnova-bulk-test.com", password: "AdminSecret123!" },
    });
    const loginBody = JSON.parse(loginRes.body);
    adminToken = loginBody.data?.accessToken;
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  it("Test 1: POST /api/v1/employees/bulk/validate with valid rows returns errorCount: 0", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          {
            email: "alice.valid@talnova-bulk-test.com",
            name: "Alice Developer",
            department: "Engineering",
            role: "employee",
            managerEmail: managerEmail,
          },
        ],
        options: { updateExisting: false },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.totalRows).toBe(1);
    expect(body.data.validCount).toBe(1);
    expect(body.data.errorCount).toBe(0);
    expect(body.data.errors).toHaveLength(0);
  });

  it("Test 2: In-batch duplicate emails are flagged with correct row index", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          { email: "dup@talnova-bulk-test.com", name: "User First Instance" },
          { email: "dup@talnova-bulk-test.com", name: "User Duplicate Instance" },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.errorCount).toBeGreaterThanOrEqual(1);
    const dupErr = body.data.errors.find((e: any) => e.field === "email" && e.row === 2);
    expect(dupErr).toBeDefined();
    expect(dupErr.reason).toContain("Duplicate email");
  });

  it("Test 3: Existing database emails are detected as conflicts or updates based on updateExisting", async () => {
    // Check without updateExisting (conflict mode)
    const resConflict = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [{ email: managerEmail, name: "Lead Updated Name" }],
        options: { updateExisting: false },
      },
    });

    const bodyConflict = JSON.parse(resConflict.body);
    expect(bodyConflict.data.conflicts.length).toBe(1);
    expect(bodyConflict.data.conflicts[0].email).toBe(managerEmail);

    // Check with updateExisting (update mode)
    const resUpdate = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [{ email: managerEmail, name: "Lead Updated Name" }],
        options: { updateExisting: true },
      },
    });

    const bodyUpdate = JSON.parse(resUpdate.body);
    expect(bodyUpdate.data.willUpdateCount).toBe(1);
    expect(bodyUpdate.data.conflicts.length).toBe(0);
  });

  it("Test 4: managerEmail lookup correctly validates whether manager exists in tenant", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/bulk/validate",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          {
            email: "bob@talnova-bulk-test.com",
            name: "Bob Builder",
            managerEmail: "unknown.ghost.manager@company.com",
          },
        ],
      },
    });

    const body = JSON.parse(res.body);
    const mgrWarning = body.data.warnings.find((w: any) => w.field === "managerEmail");
    expect(mgrWarning).toBeDefined();
    expect(mgrWarning.message).toContain("not yet registered");
  });

  it("Test 5: POST /api/v1/employees/import creates users and resolves managerId", async () => {
    const newHireEmail = "charlie.eng@talnova-bulk-test.com";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        users: [
          {
            email: newHireEmail,
            name: "Charlie Engineer",
            role: "employee",
            department: "Engineering",
            managerEmail: managerEmail,
          },
        ],
        options: {
          updateExisting: true,
          triggerWorkflows: false,
          autoAssignRoleChecklists: false,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);

    // Verify user was created in DB with correct managerId
    const createdUser = await User.findOne({
      "auth.email": newHireEmail,
      organizationId: new mongoose.Types.ObjectId(testOrgId),
    });
    expect(createdUser).toBeDefined();
    expect(createdUser?.employment?.managerId?.toString()).toBe(managerId);
  });
});
