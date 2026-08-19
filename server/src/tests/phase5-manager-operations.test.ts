import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";

describe("Phase 5 — Manager Operations & Team Oversight Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let managerUser: any;
  let managerToken: string;
  let directReport1: any;
  let directReport2: any;
  let unmanagedEmployee: any;
  let employeeToken: string;

  let managerB: any;
  let managerBToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Phase 5 Test Org",
      slug: `phase5-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Manager A
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "managerA@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Manager",
        lastName: "Alpha",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Engineering Manager",
      },
      permissions: {
        role: "manager",
      },
    });

    managerToken = app.jwt.sign({
      userId: managerUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "manager",
    });

    // 3. Create Manager B
    managerB = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "managerB@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Manager",
        lastName: "Beta",
      },
      employment: {
        department: "Sales",
        jobTitle: "Sales Manager",
      },
      permissions: {
        role: "manager",
      },
    });

    managerBToken = app.jwt.sign({
      userId: managerB._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "manager",
    });

    // 4. Create Direct Report 1 under Manager A
    directReport1 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "report1@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Report",
        lastName: "One",
      },
      employment: {
        managerId: managerUser._id,
        department: "Engineering",
        jobTitle: "Frontend Developer",
        status: "onboarding",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: directReport1._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 5. Create Direct Report 2 under Manager A
    directReport2 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "report2@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Report",
        lastName: "Two",
      },
      employment: {
        managerId: managerUser._id,
        department: "Engineering",
        jobTitle: "Backend Developer",
        status: "onboarding",
      },
      permissions: {
        role: "employee",
      },
    });

    // 6. Create Unmanaged Employee under Manager B
    unmanagedEmployee = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "unmanaged@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Unmanaged",
        lastName: "Employee",
      },
      employment: {
        managerId: managerB._id,
        department: "Sales",
        jobTitle: "Account Executive",
        status: "onboarding",
      },
      permissions: {
        role: "employee",
      },
    });

    // 7. Create Journey & Assignment for Direct Report 1
    const journey = await Journey.create({
      organizationId: testOrg._id,
      title: "Phase 5 Test Journey",
      slug: `phase5-jrn-${Date.now()}`,
      description: "Test journey for manager oversight",
      publishing: { status: "published", version: 1 },
      createdBy: managerUser._id,
    });

    await EmployeeAssignment.create({
      organizationId: testOrg._id,
      employeeId: directReport1._id,
      assignedBy: managerUser._id,
      journey: {
        journeyId: journey._id,
        title: journey.title,
        version: 1,
      },
      assignment: {
        assignedAt: new Date(),
        priority: "normal",
      },
      status: "in_progress",
      progress: {
        totalModules: 1,
        completedModules: 0,
        totalLessons: 2,
        completedLessons: 1,
        completionPercentage: 50,
        totalTimeSpentSeconds: 120,
      },
    });

    // 8. Create Standalone Task for Direct Report 1
    await Task.create({
      organizationId: testOrg._id,
      assignedToUserId: directReport1._id,
      employeeId: directReport1._id,
      title: "Set up 1-on-1 meeting",
      description: "Schedule initial 1-on-1",
      category: "general",
      stage: "day_1",
      status: "pending",
      priority: "normal",
      createdBy: managerUser._id,
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await EmployeeAssignment.deleteMany({ organizationId: testOrg._id });
      await Task.deleteMany({ organizationId: testOrg._id });
      await Journey.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  describe("1. Manager Dashboard Metrics (MGR-001)", () => {
    it("should fetch manager dashboard metrics summarizing direct reports", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/manager/dashboard",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalDirectReports).toBe(2);
      expect(json.data.activeOnboardingCount).toBe(2);
      expect(json.data.overallCompletionRate).toBe(50);
    });
  });

  describe("2. Team Direct Reports Roster (MGR-002)", () => {
    it("should fetch direct reports roster for Manager A", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/manager/team",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(2); // Only direct reports 1 and 2
      expect(json.data.some((u: any) => u.fullName === "Report One")).toBe(true);
      expect(json.data.some((u: any) => u.fullName === "Unmanaged Employee")).toBe(false);
    });
  });

  describe("3. Direct Report Deep-Dive Details (MGR-003, MGR-004)", () => {
    it("should fetch detailed journey and task breakdown for a direct report", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/manager/team/${directReport1._id}`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.employee.fullName).toBe("Report One");
      expect(json.data.assignments.length).toBe(1);
      expect(json.data.tasks.length).toBe(1);
    });
  });

  describe("4. Manager Nudge Notification (MGR-005)", () => {
    it("should send an instant manager nudge to a direct report", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/manager/team/${directReport1._id}/nudge`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          message: "Please complete your assigned onboarding journey!",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });
  });

  describe("5. Manager Onboarding Sign-Off (MGR-005, MGR-006)", () => {
    it("should allow manager to sign off on direct report's onboarding", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/manager/team/${directReport1._id}/sign-off`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          notes: "All onboarding requirements completed satisfactorily.",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify user employment status updated to active
      const updatedUser = await User.findById(directReport1._id);
      expect(updatedUser?.employment?.status).toBe("active");
    });
  });

  describe("6. RBAC & Direct-Report Security Boundary Isolation", () => {
    it("should forbid regular employee from accessing manager dashboard (403 FORBIDDEN)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/manager/dashboard",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should forbid Manager A from accessing Manager B's direct report details (403 FORBIDDEN)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/manager/team/${unmanagedEmployee._id}`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
