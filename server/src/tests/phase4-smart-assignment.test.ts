import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Journey from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import smartAssignmentService from "../modules/journeys/services/smart-assignment.service.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Phase 4 — Journey Automation & Smart Assignment Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let testAdmin: any;
  let engineeringUser1: any;
  let engineeringUser2: any;
  let hrUser: any;
  let testJourney: any;
  let adminToken: string;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create primary organization & admin
    testOrg = await Organization.create({
      name: "Phase 4 Test Org",
      slug: `phase4-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    testAdmin = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase4-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase4",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    // 2. Create Engineering employees
    engineeringUser1 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "eng1@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Alice",
        lastName: "Engineer",
        location: "San Francisco",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
      },
      permissions: {
        role: "employee",
      },
    });

    engineeringUser2 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "eng2@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Bob",
        lastName: "DevOps",
        location: "San Francisco",
      },
      employment: {
        department: "Engineering",
        jobTitle: "DevOps Engineer",
      },
      permissions: {
        role: "employee",
      },
    });

    // 3. Create HR employee (non-matching)
    hrUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "hr@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Carol",
        lastName: "HR",
      },
      employment: {
        department: "Human Resources",
      },
      permissions: {
        role: "employee",
      },
    });

    // 4. Create Journey targeted to Engineering
    testJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Smart Engineering Journey",
      slug: `smart-eng-${Date.now()}`,
      description: "Automated onboarding for engineering",
      publishing: { status: "published", version: 1 },
      audience: {
        departmentNames: ["Engineering"],
        locations: ["San Francisco"],
        autoEnrollNewHires: true,
        startDateOffsetDays: 14,
        reassignmentPolicy: "keep_progress",
      },
      modules: [],
      createdBy: testAdmin._id,
    });

    adminToken = app.jwt.sign({
      userId: testAdmin._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 5. Create secondary tenant organization for tenant isolation tests
    otherOrg = await Organization.create({
      name: "Phase 4 Secondary Tenant",
      slug: `secondary-phase4-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other-phase4@test.com",
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
      await Journey.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Dry-Run Smart Assignment Preview (JRN-001, JRN-003)", () => {
    it("should generate a dry-run preview listing matching employees and net new enrollees", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${testJourney._id}/assignment-preview`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalMatchingEmployees).toBe(2); // Alice & Bob
      expect(json.data.alreadyAssignedCount).toBe(0);
      expect(json.data.netNewEnrolleesCount).toBe(2);
      expect(json.data.matchingEmployees.length).toBe(2);
    });

    it("should update journey targeting rules via PATCH /api/v1/journeys/:id/targeting", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/journeys/${testJourney._id}/targeting`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          departmentNames: ["Engineering", "Human Resources"],
          autoEnrollNewHires: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.audience.departmentNames).toContain("Human Resources");

      // Revert targeting back to Engineering only
      await app.inject({
        method: "PATCH",
        url: `/api/v1/journeys/${testJourney._id}/targeting`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          departmentNames: ["Engineering"],
        },
      });
    });
  });

  describe("2. Bulk Smart Auto-Assignment Execution (JRN-002)", () => {
    it("should bulk assign the journey to all matching employees in the organization", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${testJourney._id}/smart-assign`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.assignedCount).toBe(2);

      // Verify assignments in database
      const assignments = await EmployeeAssignment.find({
        organizationId: testOrg._id,
        "journey.journeyId": testJourney._id,
      });
      expect(assignments.length).toBe(2);
    });

    it("should skip already assigned employees on subsequent smart-assign executions", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${testJourney._id}/smart-assign`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.assignedCount).toBe(0);
      expect(json.data.skippedCount).toBe(2);
    });
  });

  describe("3. Event-Driven New Hire Auto-Enrollment (JRN-002)", () => {
    it("should automatically enroll a new engineering hire when a USER_CREATED event fires", async () => {
      const newHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "newhire-eng@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "Dave",
          lastName: "JuniorDev",
          location: "San Francisco",
        },
        employment: {
          department: "Engineering",
          jobTitle: "Junior Software Engineer",
        },
        permissions: {
          role: "employee",
        },
      });

      const autoEnrolledCount = await smartAssignmentService.autoEnrollNewHire(
        testOrg._id.toString(),
        newHire._id.toString()
      );

      expect(autoEnrolledCount).toBe(1);

      // Verify new hire assignment created in database
      const assignment = await EmployeeAssignment.findOne({
        organizationId: testOrg._id,
        employeeId: newHire._id,
        "journey.journeyId": testJourney._id,
      });
      expect(assignment).not.toBeNull();
    });
  });

  describe("4. Multi-Tenant Smart Assignment Isolation", () => {
    it("should forbid User B of Org B from previewing or smart-assigning Journeys of Org A", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${testJourney._id}/assignment-preview`,
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
