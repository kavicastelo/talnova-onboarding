import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import Journey from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import advancedJourneyService from "../modules/journeys/services/advanced-journey.service.js";

describe("Phase 10 — Advanced Journey & Learning Experience Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let employeeUser: any;
  let adminToken: string;
  let employeeToken: string;

  let foundationJourney: any;
  let advancedJourney: any;
  let remediationJourney: any;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    const ts = Date.now();
    await User.deleteMany({ "auth.email": { $regex: "^phase10-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 10 Test Org",
      slug: `phase10-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase10-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase10",
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

    // 3. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase10-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "John",
        lastName: "Learner",
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

    // 4. Create Remediation Journey C
    remediationJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Remediation Fundamentals",
      slug: `remediation-${Date.now()}`,
      description: "Review fundamentals for low quiz scores",
      tags: ["remediation"],
      audience: {},
      modules: [],
      publishing: { status: "published", version: 1 },
      createdBy: adminUser._id,
    });

    // 5. Create Foundation Journey A
    foundationJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Foundation Security Training",
      slug: `foundation-${Date.now()}`,
      description: "Core company security requirements",
      tags: ["security"],
      audience: {},
      modules: [
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Module 1",
          order: 1,
          estimatedDurationMinutes: 10,
          lessons: [],
        },
        {
          _id: new mongoose.Types.ObjectId(),
          title: "Module 2",
          order: 2,
          estimatedDurationMinutes: 15,
          lessons: [],
        },
      ],
      conditionalBranches: [
        {
          minScore: 0,
          maxScore: 69,
          unlockJourneyId: remediationJourney._id,
          message: "Remediation journey assigned to help you catch up.",
        },
      ],
      publishing: { status: "published", version: 1 },
      createdBy: adminUser._id,
    });

    // 6. Create Advanced Journey B with Prerequisite Foundation Journey A
    advancedJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Advanced System Architecture",
      slug: `advanced-${Date.now()}`,
      description: "Advanced engineering practices",
      tags: ["advanced"],
      audience: {},
      prerequisites: [foundationJourney._id],
      modules: [],
      publishing: { status: "published", version: 1 },
      createdBy: adminUser._id,
    });

    // 7. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 10 Other Org",
      slug: `phase10-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other10-admin@test.com",
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

  describe("1. Prerequisite Journey Requirements & Gates (JRN-005)", () => {
    it("should lock Advanced Journey when prerequisite Foundation Journey is incomplete", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${advancedJourney._id}/prerequisites-check`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.locked).toBe(true);
      expect(json.data.pendingPrerequisites.length).toBe(1);
      expect(json.data.pendingPrerequisites[0].title).toBe("Foundation Security Training");
    });

    it("should unlock Advanced Journey when prerequisite Foundation Journey is completed", async () => {
      // Mark Foundation Journey as completed for employee
      await EmployeeAssignment.create({
        organizationId: testOrg._id,
        employeeId: employeeUser._id,
        journeyId: foundationJourney._id,
        journey: {
          journeyId: foundationJourney._id,
          title: foundationJourney.title,
          version: 1,
        },
        assignedBy: adminUser._id,
        assignment: {
          assignedAt: new Date(),
          priority: "normal",
        },
        status: "completed",
        progress: {
          totalModules: 1,
          completedModules: 1,
          totalLessons: 1,
          completedLessons: 1,
          completionPercentage: 100,
          totalTimeSpentSeconds: 600,
        },
      });

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${advancedJourney._id}/prerequisites-check`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.locked).toBe(false);
      expect(json.data.pendingPrerequisites.length).toBe(0);
    });
  });

  describe("2. Adaptive Branching & Remediation Paths (JRN-006)", () => {
    it("should auto-assign Remediation Journey when quiz score triggers conditional branch", async () => {
      const branchResult = await advancedJourneyService.processAdaptiveBranching(
        testOrg._id,
        employeeUser._id,
        foundationJourney._id,
        50 // Low quiz score triggers branch rule (0 - 69%)
      );

      expect(branchResult).toBeDefined();
      expect(branchResult?.title).toBe("Remediation Fundamentals");

      // Verify assignment was created for remediation journey
      const assignment = await EmployeeAssignment.findOne({
        organizationId: testOrg._id,
        employeeId: employeeUser._id,
        $or: [
          { journeyId: remediationJourney._id },
          { "journey.journeyId": remediationJourney._id },
        ],
      });
      expect(assignment).not.toBeNull();
    });
  });

  describe("3. Deep Journey Cloning & Curriculum Reordering (LMS-001)", () => {
    it("should clone journey with all modules and reset version to draft via POST /api/v1/journeys/:id/clone", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${foundationJourney._id}/clone`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toContain("Foundation Security Training (Copy)");
      expect(json.data.publishing.status).toBe("draft");
      expect(json.data.modules.length).toBe(2);
    });

    it("should reorder curriculum modules via PUT /api/v1/journeys/:id/reorder", async () => {
      const mod1Id = foundationJourney.modules[0]._id.toString();
      const mod2Id = foundationJourney.modules[1]._id.toString();

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/journeys/${foundationJourney._id}/reorder`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          moduleOrders: [
            { moduleId: mod1Id, order: 2 },
            { moduleId: mod2Id, order: 1 },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.modules[0]._id.toString()).toBe(mod2Id);
    });
  });

  describe("4. Learning Reminder Dispatching (LMS-002)", () => {
    it("should dispatch learning reminder notifications for approaching/overdue assignments", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/journeys/reminders/dispatch",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.dispatchedCount).toBeDefined();
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should forbid Tenant B admin from cloning Tenant A journey", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/journeys/${foundationJourney._id}/clone`,
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
