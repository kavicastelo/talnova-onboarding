import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { Journey } from "../modules/journeys/models/journey.model.js";
import { EmployeeAssignment } from "../modules/assignments/models/assignment.model.js";

describe("Talnova Backend Integration Test Suite", () => {
  let app: any;
  let orgAId: mongoose.Types.ObjectId;
  let orgBId: mongoose.Types.ObjectId;
  let adminAUser: any;
  let employeeAUser: any;
  let adminBUser: any;

  let adminAToken: string;
  let employeeAToken: string;
  let adminBToken: string;

  beforeAll(async () => {
    // 1. Initialize app
    app = await buildApp();

    // 2. Connect to database
    await connectDatabase(app.log);

    // 3. Clear database test collections
    await Organization.deleteMany({ name: /Test Org/ });
    await User.deleteMany({ "auth.email": /test/ });
    await Journey.deleteMany({ title: /Test Journey/ });
    await EmployeeAssignment.deleteMany({});

    const dummyCreatorId = new mongoose.Types.ObjectId();
    // 4. Seed test organizations
    const orgA = await Organization.create({
      name: "Test Org A",
      slug: "test-org-a",
      createdBy: dummyCreatorId,
      isDeleted: false,
    });
    orgAId = orgA._id as mongoose.Types.ObjectId;

    const orgB = await Organization.create({
      name: "Test Org B",
      slug: "test-org-b",
      createdBy: dummyCreatorId,
      isDeleted: false,
    });
    orgBId = orgB._id as mongoose.Types.ObjectId;

    // 5. Seed users
    adminAUser = await User.create({
      organizationId: orgAId,
      auth: {
        email: "admin-a@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false,
    });

    employeeAUser = await User.create({
      organizationId: orgAId,
      auth: {
        email: "employee-a@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Employee", lastName: "A" },
      permissions: { role: "employee" },
      employment: { status: "active" },
      isDeleted: false,
    });

    adminBUser = await User.create({
      organizationId: orgBId,
      auth: {
        email: "admin-b@test.com",
        passwordHash: "hash-placeholder",
        failedLoginAttempts: 0,
      },
      profile: { firstName: "Admin", lastName: "B" },
      permissions: { role: "admin" },
      employment: { status: "active" },
      isDeleted: false,
    });

    // 6. Generate access tokens using Fastify JWT helper
    adminAToken = app.jwt.sign({
      userId: adminAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "admin",
    });

    employeeAToken = app.jwt.sign({
      userId: employeeAUser._id.toString(),
      organizationId: orgAId.toString(),
      role: "employee",
    });

    adminBToken = app.jwt.sign({
      userId: adminBUser._id.toString(),
      organizationId: orgBId.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    // Clean up seeded documents
    await Organization.deleteMany({ name: /Test Org/ });
    await User.deleteMany({ "auth.email": /test/ });
    await Journey.deleteMany({ title: /Test Journey/ });
    await EmployeeAssignment.deleteMany({});
    
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("System Health Check Hooks", () => {
    it("should return live state status successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/live",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("alive");
    });

    it("should return ready state checks successfully", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/ready",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("UP");
      expect(body.services.database).toBe("connected");
    });

    it("should return healthy status", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("healthy");
    });
  });

  describe("API Authentication Validation", () => {
    it("should reject unauthenticated request on protected route", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    it("should allow request on protected route with valid token", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/journeys",
        headers: {
          Authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe("Tenant / Organization Boundary Isolation Checks", () => {
    let journeyOrgB: any;

    beforeAll(async () => {
      // Create a journey belonging to Organization B
      journeyOrgB = await Journey.create({
        organizationId: orgBId,
        title: "Test Journey for Org B",
        slug: "test-journey-org-b",
        description: "Test description",
        publishing: { status: "published", version: 1 },
        modules: [],
        createdBy: adminBUser._id,
        isDeleted: false,
      });
    });

    it("should prevent User of Org A from reading Journey of Org B", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminAToken}`, // Admin of Org A tries to access Org B
        },
      });

      // Query returns 404 since it filters by organizationId in the repository
      expect(response.statusCode).toBe(404);
    });

    it("should permit User of Org B to read their own Journey", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/journeys/${journeyOrgB._id.toString()}`,
        headers: {
          Authorization: `Bearer ${adminBToken}`, // Admin of Org B accesses Org B
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Test Journey for Org B");
    });
  });

  describe("Learning Engine Progression Flow", () => {
    let journey: any;
    let assignment: any;

    beforeAll(async () => {
      // Create a valid journey for Org A
      journey = await Journey.create({
        organizationId: orgAId,
        title: "Test Journey Org A",
        slug: "test-journey-org-a",
        description: "Test description",
        publishing: { status: "published", version: 1 },
        modules: [
          {
            _id: new mongoose.Types.ObjectId(),
            title: "Module 1",
            order: 0,
            lessons: [
              {
                _id: new mongoose.Types.ObjectId(),
                title: "Lesson 1",
                order: 0,
                contentBlocks: [
                  {
                    _id: new mongoose.Types.ObjectId(),
                    type: "text",
                    content: "Welcome block",
                    order: 0,
                  },
                ],
              },
            ],
          },
        ],
        createdBy: adminAUser._id,
        isDeleted: false,
      });

      // Create an assignment for employee A
      assignment = await EmployeeAssignment.create({
        organizationId: orgAId,
        employeeId: employeeAUser._id,
        assignedBy: adminAUser._id,
        journey: {
          journeyId: journey._id,
          title: journey.title,
          version: 1,
        },
        status: "assigned",
        progress: {
          lastActivityAt: new Date(),
          totalModules: 1,
          completedModules: 0,
          totalLessons: 1,
          completedLessons: 0,
          completionPercentage: 0,
          totalTimeSpentSeconds: 0,
        },
        modules: [
          {
            moduleId: journey.modules[0]._id,
            title: journey.modules[0].title,
            completed: false,
            lessons: [
              {
                lessonId: journey.modules[0].lessons[0]._id,
                title: journey.modules[0].lessons[0].title,
                status: "not_started",
                completedAt: undefined,
                timeSpentSeconds: 0,
                contentBlocks: [
                  {
                    blockId: journey.modules[0].lessons[0].contentBlocks[0]._id,
                    type: "text",
                    viewed: false,
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it("should allow employee to start the assignment", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assignments/${assignment._id.toString()}/start`,
        headers: {
          Authorization: `Bearer ${employeeAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("in_progress");
    });

    it("should automatically progress assignment state on lesson completion", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/assignments/${assignment._id.toString()}/complete-lesson`,
        headers: {
          Authorization: `Bearer ${employeeAToken}`,
        },
        payload: {
          moduleId: journey.modules[0]._id.toString(),
          lessonId: journey.modules[0].lessons[0]._id.toString(),
          timeSpentSeconds: 120,
          completedBlockIds: [journey.modules[0].lessons[0].contentBlocks[0]._id.toString()],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      // Completing the only lesson completes the assignment
      expect(body.data.status).toBe("completed");
      expect(body.data.progress.completionPercentage).toBe(100);
    });
  });
});
