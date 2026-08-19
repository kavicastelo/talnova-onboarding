import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import MilestoneTemplate from "../modules/milestones/models/milestone-template.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import milestoneService from "../modules/milestones/services/milestone.service.js";

describe("Phase 7 — 30/60/90-Day Milestones & Check-Ins Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let managerUser: any;
  let employeeUser: any;
  let adminToken: string;
  let managerToken: string;
  let employeeToken: string;

  let createdTemplate: any;
  let createdMilestone: any;

  let otherOrg: any;
  let otherManager: any;
  let otherManagerToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 7 Test Org",
      slug: `phase7-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase7-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase7",
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

    // 3. Create Manager User
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase7-manager@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Jane",
        lastName: "Manager",
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

    // 4. Create Employee User assigned to Manager
    const hireDate = new Date("2026-08-01T00:00:00.000Z");
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase7-employee@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "John",
        lastName: "Doe",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        managerId: managerUser._id,
        hireDate,
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

    // 5. Create Secondary Tenant Manager
    otherOrg = await Organization.create({
      name: "Phase 7 Other Org",
      slug: `phase7-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherManager = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other7-manager@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "Manager",
      },
      permissions: {
        role: "manager",
      },
    });

    otherManagerToken = app.jwt.sign({
      userId: otherManager._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "manager",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await EmployeeMilestone.deleteMany({ organizationId: testOrg._id });
      await MilestoneTemplate.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Milestone Template Management (S90-001)", () => {
    it("should create a 30-Day milestone template via POST /api/v1/milestones/templates", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/milestones/templates",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: "Day 30 Integration Milestone",
          targetDay: 30,
          goals: [
            { title: "Complete initial security & tools training" },
            { title: "Conduct 1-on-1 feedback session with manager" },
          ],
          checkinQuestions: [
            { question: "What were your biggest accomplishments in Month 1?", type: "text", required: true },
          ],
          audience: {
            autoAssignNewHires: true,
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.targetDay).toBe(30);
      createdTemplate = json.data;
    });

    it("should list milestone templates for organization", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/milestones/templates",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Milestone Assignment & Hire-Date Relative Scheduling (S90-002)", () => {
    it("should assign milestone template and calculate target due date from hire date", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/milestones/assign",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          templateId: createdTemplate._id,
          employeeId: employeeUser._id.toString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("pending");
      expect(json.data.targetDay).toBe(30);

      // Verify calculated due date is 30 days after hire date (2026-08-01 + 30 days = 2026-08-31)
      const expectedDueDate = new Date("2026-08-31T00:00:00.000Z").getTime();
      const actualDueDate = new Date(json.data.dueDate).getTime();
      expect(Math.abs(actualDueDate - expectedDueDate)).toBeLessThan(24 * 60 * 60 * 1000);

      createdMilestone = json.data;
    });

    it("should allow employee to fetch assigned milestones via GET /api/v1/milestones/my-milestones", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/milestones/my-milestones",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Employee Self Check-In (S90-003)", () => {
    it("should allow employee to submit self check-in and transition status to in_review", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/milestones/${createdMilestone._id}/self-checkin`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          responses: [
            {
              questionId: createdTemplate.checkinQuestions[0]._id,
              question: "What were your biggest accomplishments in Month 1?",
              answer: "Finished initial learning journey and completed IT setup.",
            },
          ],
          confidenceRating: 5,
          comments: "Feeling great about team integration!",
          goalsCompletedTitles: ["Complete initial security & tools training"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("in_review");
      expect(json.data.employeeSelfCheck.confidenceRating).toBe(5);
    });
  });

  describe("4. Manager Review & Sign-Off (S90-004, S90-005)", () => {
    it("should allow manager to fetch team milestones via GET /api/v1/milestones/team-milestones", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/milestones/team-milestones",
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should allow manager to submit performance rating and approve milestone completion", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/milestones/${createdMilestone._id}/manager-review`,
        headers: {
          authorization: `Bearer ${managerToken}`,
        },
        payload: {
          approvalStatus: "approved",
          performanceRating: 5,
          feedback: "Outstanding Month 1 progress! Keep up the great work.",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("completed");
      expect(json.data.managerReview.approvalStatus).toBe("approved");
      expect(json.data.managerReview.performanceRating).toBe(5);
    });
  });

  describe("5. Auto-Assignment on User Creation (S90-002)", () => {
    it("should auto-assign 30, 60, and 90-day milestone programs for new hire", async () => {
      const newHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "milestone-newhire@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "Milestone",
          lastName: "NewHire",
        },
        employment: {
          hireDate: new Date(),
        },
        permissions: {
          role: "employee",
        },
      });

      const count = await milestoneService.autoAssignMilestonesToNewHire(testOrg._id, newHire._id);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("6. Multi-Tenant Boundary Isolation", () => {
    it("should return empty team milestones for Tenant B manager", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/milestones/team-milestones",
        headers: {
          authorization: `Bearer ${otherManagerToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
