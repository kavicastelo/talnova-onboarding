import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Journey Test UJ-ADM-003: Bulk Import Employees via CSV", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;
  const capturedEvents: any[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Acme Bulk Import Corp ${ts}`,
      slug: `acme-bulk-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
      departments: [
        { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
        { _id: new mongoose.Types.ObjectId(), name: "Marketing", active: true },
      ],
    });

    // 2. Create Admin user
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-bulk-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Admin",
        lastName: "User",
        fullName: "Admin User",
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

    // 3. Create regular Employee user for authorization tests
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-bulk-${ts}@test.com`,
        passwordHash: "argon2_test_hash",
        emailVerified: true,
      },
      profile: {
        firstName: "Normal",
        lastName: "Employee",
        fullName: "Normal Employee",
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

    // 4. Subscribe to eventBus to capture USER_CREATED events
    eventBus.subscribe("USER_CREATED", async (event: any) => {
      capturedEvents.push(event);
    });

    // Clean up any test users from prior runs
    await User.deleteMany({
      "auth.email": {
        $in: [
          "alice_csv@test.com",
          "bob_csv@test.com",
          "charlie_csv@test.com",
          "david_csv@test.com",
          "eve_csv@test.com",
        ],
      },
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await User.deleteMany({
      "auth.email": {
        $in: [
          "alice_csv@test.com",
          "bob_csv@test.com",
          "charlie_csv@test.com",
          "david_csv@test.com",
          "eve_csv@test.com",
        ],
      },
    });
    await app.close();
  });

  it("Happy Path: Successfully imports 3 valid rows from CSV data", async () => {
    const payload = {
      users: [
        {
          fullName: "Alice Walker",
          email: "alice_csv@test.com",
          department: "Engineering",
          jobTitle: "Frontend Dev",
          employmentType: "full_time",
          hireDate: "2026-10-01",
        },
        {
          fullName: "Bob Martinez",
          email: "bob_csv@test.com",
          department: "Marketing",
          jobTitle: "Content Specialist",
          employmentType: "full_time",
          hireDate: "2026-10-01",
        },
        {
          fullName: "Charlie Kim",
          email: "charlie_csv@test.com",
          department: "Sales",
          jobTitle: "Account Exec",
          employmentType: "full_time",
          hireDate: "2026-10-01",
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);

    // Assert response: { imported: 3, skipped: 0, errors: [] }
    expect(json.imported).toBe(3);
    expect(json.skipped).toBe(0);
    expect(json.errors).toEqual([]);
    expect(json.data.successCount).toBe(3);
    expect(json.data.failures).toEqual([]);

    // Data Integrity Checks: Verify all 3 records in MongoDB with matching organizationId
    const importedUsers = await User.find({
      "auth.email": { $in: ["alice_csv@test.com", "bob_csv@test.com", "charlie_csv@test.com"] },
    });

    expect(importedUsers).toHaveLength(3);

    const alice = importedUsers.find((u) => u.auth.email === "alice_csv@test.com");
    expect(alice).toBeDefined();
    expect(alice?.profile.fullName).toBe("Alice Walker");
    expect(alice?.profile.firstName).toBe("Alice");
    expect(alice?.profile.lastName).toBe("Walker");
    expect(alice?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(alice?.employment.employmentType).toBe("full_time");
    expect(alice?.employment.designation).toBe("Frontend Dev");

    const bob = importedUsers.find((u) => u.auth.email === "bob_csv@test.com");
    expect(bob).toBeDefined();
    expect(bob?.profile.fullName).toBe("Bob Martinez");
    expect(bob?.organizationId.toString()).toBe(testOrg._id.toString());

    const charlie = importedUsers.find((u) => u.auth.email === "charlie_csv@test.com");
    expect(charlie).toBeDefined();
    expect(charlie?.profile.fullName).toBe("Charlie Kim");
    expect(charlie?.organizationId.toString()).toBe(testOrg._id.toString());
    expect(charlie?.employment.department).toBe("Sales"); // Automatically created department

    // Integration Checks: Check batch events emitted
    const userCreatedEvents = capturedEvents.filter((e) =>
      ["alice_csv@test.com", "bob_csv@test.com", "charlie_csv@test.com"].includes(e.payload?.email)
    );
    expect(userCreatedEvents.length).toBeGreaterThanOrEqual(3);
  });

  it("Alternative Path: Handles duplicate row gracefully (2 valid, 1 duplicate skipped)", async () => {
    // alice_csv@test.com already exists from previous test
    const payload = {
      users: [
        {
          fullName: "Alice Walker",
          email: "alice_csv@test.com", // DUPLICATE
          department: "Engineering",
          jobTitle: "Frontend Dev",
        },
        {
          fullName: "David Chen",
          email: "david_csv@test.com", // NEW
          department: "Engineering",
          jobTitle: "Backend Dev",
        },
        {
          fullName: "Eve Adams",
          email: "eve_csv@test.com", // NEW
          department: "Design",
          jobTitle: "Product Designer",
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);

    // 2 valid imported, 1 duplicate skipped
    expect(json.imported).toBe(2);
    expect(json.skipped).toBe(1);
    expect(json.errors).toHaveLength(1);
    expect(json.errors[0].email).toBe("alice_csv@test.com");
    expect(json.errors[0].reason).toMatch(/already exists/i);

    // Verify David and Eve were created
    const david = await User.findOne({ "auth.email": "david_csv@test.com" });
    const eve = await User.findOne({ "auth.email": "eve_csv@test.com" });
    expect(david).not.toBeNull();
    expect(eve).not.toBeNull();
  });

  it("Negative Test: Rejects malformed payload or missing required email with HTTP 400", async () => {
    const invalidPayload = {
      users: [
        {
          fullName: "No Email User",
          // email missing!
          department: "Engineering",
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${adminToken}`,
      },
      payload: invalidPayload,
    });

    expect([400, 422]).toContain(res.statusCode);
  });

  it("Authorization Test: Regular employees cannot access import endpoint (returns HTTP 403)", async () => {
    const payload = {
      users: [
        {
          fullName: "Forbidden Hire",
          email: "forbidden@test.com",
          department: "Security",
        },
      ],
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/employees/import",
      headers: {
        authorization: `Bearer ${employeeToken}`,
      },
      payload,
    });

    expect(res.statusCode).toBe(403);
  });
});
