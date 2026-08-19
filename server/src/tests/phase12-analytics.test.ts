import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import ScheduledReport from "../modules/analytics/models/scheduled-report.model.js";

describe("Phase 12 — Analytics & Operational Reporting Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;

  let createdReport: any;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase12-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 12 Test Org",
      slug: `phase12-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase12-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase12",
        lastName: "Admin",
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

    // 3. Create Completed Assignment for Time-to-Completion test
    await EmployeeAssignment.create({
      organizationId: testOrg._id,
      employeeId: adminUser._id,
      journeyId: dummyId,
      journey: {
        journeyId: dummyId,
        title: "Test Onboarding Journey",
        version: 1,
      },
      assignedBy: adminUser._id,
      assignment: {
        assignedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Assigned 5 days ago
      },
      status: "completed",
      completedAt: new Date(),
      progress: {
        totalModules: 1,
        completedModules: 1,
        totalLessons: 1,
        completedLessons: 1,
        completionPercentage: 100,
        totalTimeSpentSeconds: 1200,
      },
    });

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 12 Other Org",
      slug: `phase12-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other12-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    otherAdminToken = app.jwt.sign({
      userId: otherAdmin._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await ScheduledReport.deleteMany({ organizationId: testOrg._id });
      await EmployeeAssignment.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Time-to-Completion & Cohort Velocity (ANA-001)", () => {
    it("should calculate average completion duration via GET /api/v1/analytics/time-to-completion", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/time-to-completion",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.averageCompletionDays).toBeGreaterThan(0);
      expect(json.data.totalCompletedAssignments).toBe(1);
    });
  });

  describe("2. Quiz & Module Bottleneck Analytics (ANA-002, ANA-003)", () => {
    it("should return module failure rates and difficult question items via GET /api/v1/analytics/bottlenecks", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/bottlenecks",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.moduleBottlenecks).toBeDefined();
      expect(json.data.difficultQuestions).toBeDefined();
    });
  });

  describe("3. CSV Export Feed (ANA-006)", () => {
    it("should return raw compliance CSV text via GET /api/v1/analytics/export", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/export",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
      expect(response.body).toContain("Employee Name,Email,Department,Journey Title,Status");
    });
  });

  describe("4. Scheduled Reports Management (ANA-006)", () => {
    it("should create scheduled report via POST /api/v1/analytics/scheduled-reports", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/analytics/scheduled-reports",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: "Weekly HR Executive Summary",
          frequency: "weekly",
          recipients: ["hr@test.com", "exec@test.com"],
          format: "csv",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("Weekly HR Executive Summary");
      createdReport = json.data;
    });

    it("should list scheduled reports via GET /api/v1/analytics/scheduled-reports", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/scheduled-reports",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });

    it("should delete scheduled report via DELETE /api/v1/analytics/scheduled-reports/:id", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/analytics/scheduled-reports/${createdReport._id}`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should isolate Tenant B analytics metrics from Tenant A data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/analytics/time-to-completion",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.totalCompletedAssignments).toBe(0);
    });
  });
});
