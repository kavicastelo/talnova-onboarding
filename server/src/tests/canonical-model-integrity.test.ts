import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User, EmployeeModel } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { EmployeeRepository } from "../modules/employees/repositories/employee.repository.js";

describe("Canonical Model & Data Consolidation Integrity Suite", () => {
  let app: any;
  let orgId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;
  let adminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);

    const dummyId = new mongoose.Types.ObjectId();
    const org = await Organization.create({
      name: "Canonical Test Org",
      slug: `canonical-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });
    orgId = org._id as mongoose.Types.ObjectId;

    const user = await User.create({
      organizationId: orgId,
      auth: {
        email: `canonical_${Date.now()}@test.com`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
        emailVerified: true,
      },
      profile: {
        firstName: "Canonical",
        lastName: "Admin",
        fullName: "Canonical Admin",
      },
      employment: {
        employmentType: "full_time",
        status: "active",
        designation: "Staff Lead",
        payrollCategory: "Salaried",
      },
      permissions: {
        role: "admin",
        customRoles: [],
      },
      preferences: {
        language: "en",
        theme: "system",
        emailNotifications: true,
      },
      isDeleted: false,
    });
    testUserId = user._id as mongoose.Types.ObjectId;

    adminToken = app.jwt.sign({
      userId: testUserId.toString(),
      organizationId: orgId.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testUserId) {
      await User.deleteOne({ _id: testUserId });
    }
    if (orgId) {
      await Organization.deleteOne({ _id: orgId });
    }
    await app.close();
    await disconnectDatabase(app.log);
  });

  it("1. Asserts 'users' is the single canonical MongoDB collection for User and Employee entities", () => {
    expect(User.collection.collectionName).toBe("users");
    expect(EmployeeModel).toBe(User);
    expect(EmployeeModel.collection.collectionName).toBe("users");
  });

  it("2. Asserts no active 'employee' or 'employees' duplicate collection exists in MongoDB", async () => {
    const collections = await mongoose.connection.db!.listCollections().toArray();
    const colNames = collections.map((c) => c.name.toLowerCase());
    expect(colNames.includes("employee")).toBe(false);
    expect(colNames.includes("employees")).toBe(false);
  });

  it("3. Asserts EmployeeRepository operates directly on canonical User model and 'users' collection", async () => {
    const repository = new EmployeeRepository();
    const found = await repository.findById(testUserId);
    expect(found).not.toBeNull();
    expect(found?.auth.email).toContain("canonical_");
    expect(found?.profile.fullName).toBe("Canonical Admin");
    expect(found?.employment.designation).toBe("Staff Lead");
  });

  it("4. Asserts /api/v1/employees is the active canonical API contract", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/employees/me",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload);
    expect(body.success).toBe(true);
    expect(body.data._id).toBe(testUserId.toString());
  });

  it("5. Asserts legacy /api/v1/users alias has been decommissioned", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
    });

    // Alias was removed to eliminate duplicate routing surface
    expect(response.statusCode).toBe(404);
  });

  it("6. Asserts unique constraint on organizationId + auth.email on canonical collection", async () => {
    const duplicateEmail = `canonical_${Date.now()}@test.com`;

    const user1 = await User.create({
      organizationId: orgId,
      auth: {
        email: duplicateEmail,
        passwordHash: "hash1",
      },
      profile: { firstName: "Test", lastName: "One", fullName: "Test One" },
      employment: { employmentType: "full_time", status: "active" },
      permissions: { role: "employee", customRoles: [] },
    });

    try {
      await expect(
        User.create({
          organizationId: orgId,
          auth: {
            email: duplicateEmail,
            passwordHash: "hash2",
          },
          profile: { firstName: "Test", lastName: "Two", fullName: "Test Two" },
          employment: { employmentType: "full_time", status: "active" },
          permissions: { role: "employee", customRoles: [] },
        })
      ).rejects.toThrow();
    } finally {
      await User.deleteOne({ _id: user1._id });
    }
  });
});
