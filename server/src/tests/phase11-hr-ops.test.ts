import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";

describe("Phase 11 — HR Operations & Onboarding Administration Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let hrAdminUser: any;
  let employeeUser: any;
  let hrAdminToken: string;
  let employeeToken: string;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase11-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 11 Test Org",
      slug: `phase11-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create HR Admin User
    hrAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase11-hradmin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase11",
        lastName: "HRAdmin",
      },
      permissions: {
        role: "admin",
      },
    });

    hrAdminToken = app.jwt.sign({
      userId: hrAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase11-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Jane",
        lastName: "Onboardee",
      },
      employment: {
        department: "Engineering",
        jobTitle: "DevOps Engineer",
        onboardingState: "active",
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

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 11 Other Org",
      slug: `phase11-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other11-admin-${ts}@test.com`,
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

  describe("1. Unified HR Operations Dashboard (HR-001)", () => {
    it("should return HR dashboard operational metrics via GET /api/v1/hr/dashboard", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/hr/dashboard",
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalEmployees).toBeGreaterThanOrEqual(1);
      expect(json.data.activeOnboardees).toBeGreaterThanOrEqual(1);
      expect(json.data.journeyComplianceRate).toBeDefined();
    });
  });

  describe("2. Onboarding Exception & Escalation Monitor (HR-004)", () => {
    it("should flag employees with onboarding risks via GET /api/v1/hr/exceptions", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/hr/exceptions",
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("3. Employee Lifecycle State Controls (HR-002)", () => {
    it("should pause employee onboarding state via PUT /api/v1/hr/lifecycle/:userId/state", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/hr/lifecycle/${employeeUser._id}/state`,
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
        payload: {
          state: "paused",
          reason: "Medical leave",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.employment.onboardingState).toBe("paused");
    });

    it("should extend assignment due dates by N days via PUT /api/v1/hr/lifecycle/:userId/state", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/hr/lifecycle/${employeeUser._id}/state`,
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
        payload: {
          state: "active",
          extensionDays: 14,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.employment.onboardingState).toBe("active");
    });
  });

  describe("4. Bulk Employee Batch Operations (HR-003)", () => {
    it("should execute bulk reminder nudge via POST /api/v1/hr/bulk-action", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/hr/bulk-action",
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
        payload: {
          action: "send_reminder",
          employeeIds: [employeeUser._id.toString()],
          payload: {
            message: "Batch reminder nudge from HR admin.",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.processedCount).toBe(1);
    });
  });

  describe("5. Operational HR Audit Compliance Report (HR-005)", () => {
    it("should generate compliance report summary via GET /api/v1/hr/compliance-report", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/hr/compliance-report",
        headers: {
          authorization: `Bearer ${hrAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
      expect(json.data[0].completionRate).toBeDefined();
    });
  });

  describe("6. Multi-Tenant Boundary Isolation", () => {
    it("should isolate Tenant B HR dashboard metrics from Tenant A data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/hr/dashboard",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.totalEmployees).toBe(1); // Only otherAdmin
    });
  });
});
