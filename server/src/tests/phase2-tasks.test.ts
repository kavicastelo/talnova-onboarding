import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Task from "../modules/tasks/models/task.model.js";
import schedulerService from "../infrastructure/scheduler/scheduler.service.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Phase 2 — Standalone Task & Checklist Engine Test Suite", () => {
  let app: FastifyInstance;
  let orgAId: string;
  let orgBId: string;
  let adminAToken: string;
  let employeeAToken: string;
  let adminBToken: string;

  let hrUserAId: string;
  let empUserAId: string;
  let empUserBId: string;

  let createdTaskId: string;
  let prereqTaskId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up test data
    await Organization.deleteMany({ slug: { $in: ["task-org-a", "task-org-b"] } });

    const dummyId = new mongoose.Types.ObjectId();

    // Create Org A
    const orgA = await Organization.create({
      name: "Task Org A",
      slug: `task-org-a-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });
    orgAId = (orgA._id as any).toString();

    // Create Org B
    const orgB = await Organization.create({
      name: "Task Org B",
      slug: `task-org-b-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });
    orgBId = (orgB._id as any).toString();

    // Create Admin A in Org A
    const adminA = await User.create({
      organizationId: orgA._id,
      auth: {
        email: "admin-a-task@test.com",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
      employment: { status: "active", hireDate: new Date() },
    });
    hrUserAId = (adminA._id as any).toString();

    // Create Employee A in Org A
    const empA = await User.create({
      organizationId: orgA._id,
      auth: {
        email: "emp-a-task@test.com",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Employee", lastName: "A" },
      permissions: { role: "employee" },
      employment: { status: "active", hireDate: new Date() },
    });
    empUserAId = (empA._id as any).toString();

    // Create Admin B in Org B
    const adminB = await User.create({
      organizationId: orgB._id,
      auth: {
        email: "admin-b-task@test.com",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Admin", lastName: "B" },
      permissions: { role: "admin" },
      employment: { status: "active", hireDate: new Date() },
    });
    empUserBId = (adminB._id as any).toString();

    adminAToken = app.jwt.sign({ userId: hrUserAId, organizationId: orgAId, role: "admin" });
    employeeAToken = app.jwt.sign({ userId: empUserAId, organizationId: orgAId, role: "employee" });
    adminBToken = app.jwt.sign({ userId: empUserBId, organizationId: orgBId, role: "admin" });
  }, 30000);

  afterAll(async () => {
    await Task.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await User.deleteMany({ organizationId: { $in: [orgAId, orgBId] } });
    await Organization.deleteMany({ _id: { $in: [orgAId, orgBId] } });
    await app.close();
  });

  describe("1. Task CRUD & Stage Checklists (CHK-001, CHK-002, CHK-003)", () => {
    it("should create a cross-person task assigned to HR for a target employee", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Setup IT Workstation & Software Access",
          description: "Provision MacBook Pro, Slack, GitHub, and 1Password accounts.",
          assignedToUserId: hrUserAId,
          employeeId: empUserAId,
          stage: "preboarding",
          category: "it_setup",
          priority: "high",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe("Setup IT Workstation & Software Access");
      expect(body.data.stage).toBe("preboarding");
      expect(body.data.category).toBe("it_setup");
      expect(body.data.status).toBe("pending");
      createdTaskId = body.data._id;
    });

    it("should list tasks for current user inbox", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/tasks?assignedToMe=true",
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data[0]._id).toBe(createdTaskId);
    });

    it("should fetch details of a specific task", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/tasks/${createdTaskId}`,
        headers: { Authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data._id).toBe(createdTaskId);
    });
  });

  describe("2. Task Prerequisite Dependency Enforcement (CHK-003, CHK-004)", () => {
    it("should create a prerequisite task and a dependent task", async () => {
      // Prerequisite task
      const prereqRes = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Complete Background Check Verification",
          assignedToUserId: hrUserAId,
          stage: "preboarding",
          category: "hr_paperwork",
        },
      });
      prereqTaskId = JSON.parse(prereqRes.body).data._id;

      // Dependent task
      const dependentRes = await app.inject({
        method: "POST",
        url: "/api/v1/tasks",
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: {
          title: "Issue Employee ID Badge",
          assignedToUserId: hrUserAId,
          stage: "day_1",
          category: "equipment",
          prerequisiteTaskIds: [prereqTaskId],
        },
      });

      expect(dependentRes.statusCode).toBe(201);
      const dependentTask = JSON.parse(dependentRes.body).data;

      // Attempt to complete dependent task before prerequisite is done -> should fail
      const completeRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/tasks/${dependentTask._id}/status`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: { status: "completed" },
      });

      expect(completeRes.statusCode).toBe(400);
      const completeBody = JSON.parse(completeRes.body);
      expect(completeBody.message).toContain("Pending prerequisite tasks");

      // Now complete the prerequisite task
      await app.inject({
        method: "PATCH",
        url: `/api/v1/tasks/${prereqTaskId}/status`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: { status: "completed" },
      });

      // Retry completing dependent task -> should succeed
      const retryRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/tasks/${dependentTask._id}/status`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: { status: "completed" },
      });

      expect(retryRes.statusCode).toBe(200);
      expect(JSON.parse(retryRes.body).data.status).toBe("completed");
    }, 15000);
  });

  describe("3. Activity Comments & Status History (CHK-004)", () => {
    it("should allow adding comments to a task", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/tasks/${createdTaskId}/comments`,
        headers: { Authorization: `Bearer ${adminAToken}` },
        payload: { comment: "Laptop ordered from Dell vendor; estimated delivery tomorrow." },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.comments.length).toBe(1);
      expect(body.data.comments[0].comment).toContain("Laptop ordered");
    });
  });

  describe("4. Task Overdue Scheduler & Notification Trigger (CHK-005)", () => {
    it("should auto-scan overdue tasks and publish TASK_OVERDUE events", async () => {
      // Create a task whose due date was yesterday
      const overdueTask = await Task.create({
        organizationId: new mongoose.Types.ObjectId(orgAId),
        createdBy: new mongoose.Types.ObjectId(hrUserAId),
        assignedToUserId: new mongoose.Types.ObjectId(empUserAId),
        title: "Submit Signed Tax W-4 Form",
        category: "hr_paperwork",
        stage: "day_1",
        status: "pending",
        dueDate: new Date(Date.now() - 86400000), // 1 day past due
        statusHistory: [],
      });

      let overdueEventFired = false;
      const unsubscribe = eventBus.subscribe("TASK_OVERDUE", (event) => {
        if (event.payload.taskId === (overdueTask._id as any).toString()) {
          overdueEventFired = true;
        }
      });

      const count = await schedulerService.scanOverdueTasks();
      expect(count).toBeGreaterThanOrEqual(1);

      const updatedTask = await Task.findById(overdueTask._id);
      expect(updatedTask?.status).toBe("overdue");
      expect(overdueEventFired).toBe(true);

      unsubscribe();
    });
  });

  describe("5. Multi-Tenant Task Isolation", () => {
    it("User B from Org B cannot view or modify Tasks of Org A", async () => {
      // Try to fetch Org A task using Org B token
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/tasks/${createdTaskId}`,
        headers: { Authorization: `Bearer ${adminBToken}` },
      });

      expect(getRes.statusCode).toBe(404);

      // Try to modify Org A task using Org B token
      const updateRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/tasks/${createdTaskId}/status`,
        headers: { Authorization: `Bearer ${adminBToken}` },
        payload: { status: "completed" },
      });

      expect(updateRes.statusCode).toBe(404);
    }, 15000);
  });
});
