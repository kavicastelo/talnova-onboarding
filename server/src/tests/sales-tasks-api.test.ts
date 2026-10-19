import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("CRM-003: Sales Activities, Tasks & Calendar API", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testCompany: any;
  let testContact: any;
  let testLead: any;
  let testDeal: any;
  let defaultPipeline: any;

  const testPrefix = `task-test-${Date.now()}`;
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Task Test Org ${testPrefix}`,
      slug: `task-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `task-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Task",
        lastName: "Admin",
        fullName: "Task Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        customRoles: [],
      },
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `task-employee-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Sales",
        fullName: "Regular Sales",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "employee",
        customRoles: [],
      },
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    regularToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      email: regularUser.auth.email,
      role: regularUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // Create base company
    testCompany = await Company.create({
      name: `Task Test Corp ${testPrefix}`,
      domain: `task-${testPrefix}.test`,
      industry: "Software",
      tier: "enterprise",
      status: "qualified",
    });
    createdCompanyIds.push(testCompany._id);

    // Create base contact
    testContact = await Contact.create({
      companyId: testCompany._id,
      firstName: "Alex",
      lastName: "Smith",
      fullName: "Alex Smith",
      email: `alex-${testPrefix}@task.test`,
      normalizedEmail: `alex-${testPrefix}@task.test`.toLowerCase(),
      isPrimaryDecisionMaker: true,
    });
    createdContactIds.push(testContact._id);

    // Create base lead
    testLead = await Lead.create({
      name: `Prospect Lead ${testPrefix}`,
      companyName: testCompany.name,
      email: `prospect-${testPrefix}@task.test`,
      normalizedEmail: `prospect-${testPrefix}@task.test`.toLowerCase(),
      status: "new",
      priority: "high",
      score: 75,
    });
    createdLeadIds.push(testLead._id);

    // Ensure default pipeline
    const pipeRes = await app.inject({
      method: "GET",
      url: "/api/v1/sales/pipelines/default",
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    defaultPipeline = JSON.parse(pipeRes.body).data;

    // Create base deal
    testDeal = await Deal.create({
      name: `Strategic CRM Deal ${testPrefix}`,
      companyId: testCompany._id,
      primaryContactId: testContact._id,
      leadId: testLead._id,
      pipelineId: defaultPipeline._id,
      stage: "qualification",
      value: 75000,
      probability: 0.1,
    });
    createdDealIds.push(testDeal._id);
  });

  afterAll(async () => {
    if (createdTaskIds.length > 0) {
      await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Route Protection & RBAC Guard", () => {
    it("should reject unauthenticated request with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject non-super_admin role with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow super_admin access to list tasks", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("2. Task Creation & Polymorphic Linkage Validation", () => {
    it("should reject task creation when referenced company does not exist", async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: "Follow up with phantom company",
          companyId: nonExistentId.toString(),
          dueDate: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("COMPANY_NOT_FOUND");
    });

    it("should create a task with complete polymorphic linkages and record AuditLog", async () => {
      const dueDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const payload = {
        title: `Discovery Follow-up ${testPrefix}`,
        description: "Review enterprise security checklist and send revised proposal.",
        type: "meeting",
        priority: "high",
        dueDate,
        assignedTo: superAdminUser._id.toString(),
        leadId: testLead._id.toString(),
        contactId: testContact._id.toString(),
        companyId: testCompany._id.toString(),
        dealId: testDeal._id.toString(),
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.title).toBe(payload.title);
      expect(body.data.type).toBe("meeting");
      expect(body.data.priority).toBe("high");
      expect(body.data.status).toBe("pending");
      expect(body.data.companyId).toBe(payload.companyId);
      expect(body.data.dealId).toBe(payload.dealId);

      createdTaskIds.push(new mongoose.Types.ObjectId(body.data._id));

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(body.data._id),
        eventType: "TASK_CREATED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe("create");
      expect(auditLog!.resourceType).toBe("sales_task");
    });
  });

  describe("3. Due Date Partitioning & Summary Counters", () => {
    let overdueTask: any;
    let todayTask: any;
    let upcomingTask: any;

    beforeAll(async () => {
      // 1. Overdue Task: 3 days in the past
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const resPast = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Overdue Task ${testPrefix}`,
          dueDate: pastDate,
          type: "call",
          priority: "urgent",
        },
      });
      overdueTask = JSON.parse(resPast.body).data;
      createdTaskIds.push(new mongoose.Types.ObjectId(overdueTask._id));

      // 2. Today Task: current hour
      const todayDate = new Date().toISOString();
      const resToday = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Today Task ${testPrefix}`,
          dueDate: todayDate,
          type: "demo",
          priority: "high",
        },
      });
      todayTask = JSON.parse(resToday.body).data;
      createdTaskIds.push(new mongoose.Types.ObjectId(todayTask._id));

      // 3. Upcoming Task: 5 days in future
      const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const resFuture = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Upcoming Task ${testPrefix}`,
          dueDate: futureDate,
          type: "proposal",
          priority: "normal",
        },
      });
      upcomingTask = JSON.parse(resFuture.body).data;
      createdTaskIds.push(new mongoose.Types.ObjectId(upcomingTask._id));
    });

    it("should filter overdue tasks accurately", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks?dueFilter=overdue",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.some((t: any) => t._id === overdueTask._id)).toBe(true);
      expect(body.data.some((t: any) => t._id === upcomingTask._id)).toBe(false);
    });

    it("should filter today tasks accurately", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks?dueFilter=today",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.some((t: any) => t._id === todayTask._id)).toBe(true);
      expect(body.data.some((t: any) => t._id === overdueTask._id)).toBe(false);
    });

    it("should filter upcoming tasks accurately", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks?dueFilter=upcoming&limit=100",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.some((t: any) => t._id === upcomingTask._id.toString())).toBe(true);
      expect(body.data.some((t: any) => t._id === overdueTask._id.toString())).toBe(false);
    });

    it("should return correct counters on task list response", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.counters).toBeDefined();
      expect(body.counters.overdue).toBeGreaterThanOrEqual(1);
      expect(body.counters.today).toBeGreaterThanOrEqual(1);
      expect(body.counters.upcoming).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Task Update & Completion Workflow", () => {
    let taskToComplete: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Action Item ${testPrefix}`,
          dueDate: new Date().toISOString(),
          type: "call",
          priority: "high",
        },
      });
      taskToComplete = JSON.parse(res.body).data;
      createdTaskIds.push(new mongoose.Types.ObjectId(taskToComplete._id));
    });

    it("should update task attributes via PATCH /:id", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/tasks/${taskToComplete._id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Updated Action Item ${testPrefix}`,
          priority: "urgent",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.title).toContain("Updated Action Item");
      expect(body.data.priority).toBe("urgent");
    });

    it("should mark task completed via PATCH /:id/complete and record outcomeNotes", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/tasks/${taskToComplete._id}/complete`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          outcomeNotes: "Customer requested a POC agreement by Friday.",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe("completed");
      expect(body.data.completedAt).toBeDefined();
      expect(body.data.outcomeNotes).toBe("Customer requested a POC agreement by Friday.");

      // Verify AuditLog record
      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(taskToComplete._id),
        eventType: "TASK_COMPLETED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe("complete");
    });
  });

  describe("5. Calendar View Aggregations", () => {
    it("should return calendar tasks grouped by day within date window", async () => {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/tasks/calendar?startDate=${startDate}&endDate=${endDate}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const calendar = body.data;
      expect(calendar.startDate).toBe(startDate);
      expect(calendar.endDate).toBe(endDate);
      expect(typeof calendar.totalTasks).toBe("number");
      expect(Array.isArray(calendar.days)).toBe(true);

      // Verify day items format
      for (const day of calendar.days) {
        expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(day.count).toBeGreaterThan(0);
        expect(Array.isArray(day.tasks)).toBe(true);
      }
    });
  });

  describe("6. Task Deletion", () => {
    let disposableTask: any;

    beforeAll(async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          title: `Disposable Task ${testPrefix}`,
          dueDate: new Date().toISOString(),
        },
      });
      disposableTask = JSON.parse(res.body).data;
    });

    it("should delete the task and log an AuditLog entry", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/tasks/${disposableTask._id}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const check = await SalesTask.findById(disposableTask._id);
      expect(check).toBeNull();

      const audit = await AuditLog.findOne({
        resourceId: disposableTask._id,
        eventType: "TASK_DELETED",
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe("delete");
    });
  });
});
