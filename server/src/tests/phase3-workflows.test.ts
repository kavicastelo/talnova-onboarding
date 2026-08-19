import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import WorkflowRule from "../modules/workflows/models/workflow-rule.model.js";
import WorkflowExecutionLog from "../modules/workflows/models/workflow-execution.model.js";
import workflowEngine from "../modules/workflows/services/workflow.engine.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Journey from "../modules/journeys/models/journey.model.js";
import Task from "../modules/tasks/models/task.model.js";
import Notification from "../modules/notifications/models/notification.model.js";

describe("Phase 3 — Workflow Automation Engine Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let testAdmin: any;
  let testTargetUser: any;
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
      name: "Phase 3 Test Org",
      slug: `phase3-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    testAdmin = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase3-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase3",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    testTargetUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "engineering-newhire@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Dev",
        lastName: "Engineer",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
      },
      permissions: {
        role: "employee",
      },
    });

    testJourney = await Journey.create({
      organizationId: testOrg._id,
      title: "Engineering Onboarding Journey",
      slug: `eng-journey-${Date.now()}`,
      description: "Welcome to engineering team",
      publishing: { status: "published" },
      modules: [],
      createdBy: testAdmin._id,
    });

    adminToken = app.jwt.sign({
      userId: testAdmin._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 2. Create secondary tenant organization for tenant isolation tests
    otherOrg = await Organization.create({
      name: "Phase 3 Secondary Tenant",
      slug: `secondary-tenant-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other-admin@test.com",
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
      await WorkflowRule.deleteMany({ organizationId: testOrg._id });
      await WorkflowExecutionLog.deleteMany({ organizationId: testOrg._id });
      await Task.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await Journey.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await WorkflowRule.deleteMany({ organizationId: otherOrg._id });
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Workflow Rule Management APIs (WF-001)", () => {
    let createdRuleId: string;

    it("should create a new automated workflow rule with conditions and actions", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/workflows",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          name: "Engineering New Hire Onboarding Rule",
          description: "Auto-assigns journey and creates IT task when a new engineer joins",
          triggerType: "user_created",
          conditions: [
            {
              field: "department",
              operator: "equals",
              value: "Engineering",
            },
          ],
          actions: [
            {
              type: "assign_journey",
              params: {
                journeyId: testJourney._id.toString(),
              },
            },
            {
              type: "create_task",
              params: {
                taskTitle: "Setup MacBook & GitHub Accounts",
                taskCategory: "it_setup",
                taskStage: "day_1",
                taskPriority: "high",
              },
            },
            {
              type: "send_notification",
              params: {
                notificationTitle: "Welcome to Engineering Team!",
                notificationMessage: "Your onboarding path is active.",
              },
            },
          ],
          isActive: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data._id).toBeDefined();
      expect(json.data.name).toBe("Engineering New Hire Onboarding Rule");
      expect(json.data.conditions.length).toBe(1);
      expect(json.data.actions.length).toBe(3);

      createdRuleId = json.data._id;
    });

    it("should list workflow rules for the current tenant", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it("should toggle a workflow rule active state", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/workflows/${createdRuleId}/toggle`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.isActive).toBe(false);

      // Toggle back to active
      await app.inject({
        method: "PATCH",
        url: `/api/v1/workflows/${createdRuleId}/toggle`,
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          isActive: true,
        },
      });
    });
  });

  describe("2. Workflow Condition Evaluator & Action Pipeline Execution (WF-001, WF-002, WF-004)", () => {
    it("should evaluate conditions correctly and execute action pipeline for matching target user", async () => {
      const executedCount = await workflowEngine.processEvent(
        testOrg._id.toString(),
        "user_created",
        testTargetUser._id.toString()
      );

      expect(executedCount).toBe(1);

      // Verify task was automatically created by workflow rule action
      const createdTask = await Task.findOne({
        organizationId: testOrg._id,
        employeeId: testTargetUser._id,
        title: "Setup MacBook & GitHub Accounts",
      });
      expect(createdTask).not.toBeNull();
      expect(createdTask?.category).toBe("it_setup");
      expect(createdTask?.priority).toBe("high");

      // Verify notification was dispatched by workflow rule action
      const notification = await Notification.findOne({
        organizationId: testOrg._id,
        recipientUserId: testTargetUser._id,
        title: "Welcome to Engineering Team!",
      });
      expect(notification).not.toBeNull();
    });

    it("should skip execution when user conditions do not match", async () => {
      // Create non-engineering target user
      const hrUser = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "hr-newhire@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "HR",
          lastName: "Specialist",
        },
        employment: {
          department: "Human Resources",
        },
        permissions: {
          role: "employee",
        },
      });

      const executedCount = await workflowEngine.processEvent(
        testOrg._id.toString(),
        "user_created",
        hrUser._id.toString()
      );

      expect(executedCount).toBe(0);
    });
  });

  describe("3. Workflow Execution History Logging (WF-005, WF-006)", () => {
    it("should record workflow execution logs with step results", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows/executions",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);

      const latestLog = json.data[0];
      expect(latestLog.status).toBe("success");
      expect(latestLog.stepResults.length).toBe(3);
    });
  });

  describe("4. Multi-Tenant Workflow Isolation", () => {
    it("should prevent User B of Org B from retrieving or modifying Workflow Rules of Org A", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/workflows",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0); // Org B has 0 rules
    });
  });
});
