import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import AICourseDraft from "../modules/ai/models/ai-course-draft.model.js";

describe("Phase 15 — AI Course & Journey Builder Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let adminToken: string;
  let employeeUser: any;
  let employeeToken: string;

  let createdDraftId: string;
  let firstModuleId: string;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase15-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 15 Test Org",
      slug: `phase15-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase15-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase15",
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
        email: `phase15-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Jane",
        lastName: "Employee",
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
      name: "Phase 15 Other Org",
      slug: `phase15-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other15-admin-${ts}@test.com`,
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
      await AICourseDraft.deleteMany({ organizationId: testOrg._id });
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

  describe("1. AI Journey Outline & Quiz Generator (AI-006, AI-007, AI-008)", () => {
    it("should synthesize AI course draft via POST /api/v1/ai/course-builder/generate", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ai/course-builder/generate",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          prompt: "DevOps Security Onboarding",
          targetRole: "DevOps Engineer",
          department: "Engineering",
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toContain("DevOps Security Onboarding");
      expect(json.data.modules.length).toBeGreaterThanOrEqual(1);
      expect(json.data.modules[0].lessons[0].quizQuestions.length).toBeGreaterThanOrEqual(1);

      createdDraftId = json.data._id;
      firstModuleId = json.data.modules[0].moduleId;
    });
  });

  describe("2. Module Regeneration Workflow (AI-009)", () => {
    it("should regenerate specific module content via POST /api/v1/ai/course-builder/drafts/:id/regenerate-module", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/ai/course-builder/drafts/${createdDraftId}/regenerate-module`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          moduleId: firstModuleId,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.version).toBe(2);
      expect(json.data.modules[0].title).toContain("Regenerated");
    });
  });

  describe("3. Publish Draft into Official Live Journey (AI-009)", () => {
    it("should publish draft into live Journeys collection via POST /api/v1/ai/course-builder/drafts/:id/publish", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/ai/course-builder/drafts/${createdDraftId}/publish`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.draft.status).toBe("published");
      expect(json.data.journey._id).toBeDefined();

      // Verify journey document created in MongoDB
      const createdJourney = await Journey.findById(json.data.journey._id);
      expect(createdJourney).toBeDefined();
      expect(createdJourney?.title).toContain("DevOps Security Onboarding");
    });
  });

  describe("4. Usage Limits & RBAC Guardrails (AI-010)", () => {
    it("should block non-admin employees from generating course drafts with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ai/course-builder/generate",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          prompt: "Unauthorized Course",
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should isolate Tenant B course drafts from Tenant A data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ai/course-builder/drafts",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
