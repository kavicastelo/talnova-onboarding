import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";

describe("Journey Test UJ-ADM-012: Company Analytics & Drop-off Monitoring", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Analytics Test Organization",
      slug: `analytics-test-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin user (view_analytics capability)
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `analytics-admin-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Analytics",
        lastName: "Admin",
      },
      employment: {
        department: "Executive",
        jobTitle: "VP of People Operations",
        status: "active",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create regular Employee user (no view_analytics capability)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `staff-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Employee",
      },
      employment: {
        department: "Sales",
        jobTitle: "Account Executive",
        status: "onboarding",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create active onboarding assignments for testOrg
    await EmployeeAssignment.create([
      {
        organizationId: testOrg._id,
        employeeId: employeeUser._id,
        journey: {
          journeyId: dummyId,
          title: "Sales Onboarding Bootcamp",
          version: 1,
        },
        assignedBy: adminUser._id,
        status: "in_progress",
        progress: {
          completionPercentage: 45,
          totalTimeSpentSeconds: 3600,
        },
      },
    ]);
  });

  afterAll(async () => {
    if (testOrg) {
      await EmployeeAssignment.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 1-4: GET /api/v1/analytics/overview returns KPI cards, funnel stages, and productivity curve", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    // Verify root or data payload structure
    const data = body.data || body;
    expect(data.activeOnboarding).toBeGreaterThanOrEqual(1);
    expect(data.avgCompletionDays).toBeDefined();
    expect(typeof data.avgCompletionDays).toBe("number");
    expect(data.retentionRate).toBeDefined();
    expect(typeof data.retentionRate).toBe("number");

    // Verify funnel stages
    expect(Array.isArray(data.funnelStages)).toBe(true);
    expect(data.funnelStages.length).toBeGreaterThanOrEqual(4);
    const firstStage = data.funnelStages[0];
    expect(firstStage.stage).toMatch(/Day 1/i);
    expect(firstStage.percentage).toBe(100);
    expect(firstStage.dropOff).toBe(0);

    // Verify productivity curve
    expect(Array.isArray(data.productivityCurve)).toBe(true);
    expect(data.productivityCurve.length).toBeGreaterThanOrEqual(4);
  });

  it("Step 5-7: GET /api/v1/analytics/overview?department=Sales filters data by department", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?department=Sales",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    const data = body.data || body;
    expect(data.department).toBe("Sales");
    expect(data.activeOnboarding).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(data.funnelStages)).toBe(true);
  });

  it("Alternative Path: Supports range parameters (90d, all)", async () => {
    const response90d = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?range=90d",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(response90d.statusCode).toBe(200);

    const responseAll = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?range=all",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    expect(responseAll.statusCode).toBe(200);
  });

  it("Negative Test: Invalid date format is handled gracefully and defaults to 30d", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview?startDate=not-a-valid-date-format",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    const data = body.data || body;
    expect(data.range).toBe("30d");
  });

  it("Authorization Test: Regular employees calling GET /api/v1/analytics/overview receive 403 Forbidden", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("Data Integrity Check: Active count corresponds to MongoDB query results", async () => {
    const expectedActiveCount = await EmployeeAssignment.countDocuments({
      organizationId: testOrg._id,
      status: { $in: ["in_progress", "assigned"] },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/analytics/overview",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });

    const body = JSON.parse(response.body);
    const data = body.data || body;
    expect(data.activeOnboarding).toBeGreaterThanOrEqual(expectedActiveCount);
  });
});
