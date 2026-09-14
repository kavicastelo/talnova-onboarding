import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Task from "../modules/tasks/models/task.model.js";
import RoleChecklistTemplate from "../modules/tasks/models/role-checklist-template.model.js";
import roleChecklistService from "../modules/tasks/services/role-checklist.service.js";
import { hashPassword } from "../utils/crypto.js";

describe("Automation Prompt 05 — Role-Based Checklist Engine & Task Auto-Assignment", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let adminId: string;
  let adminToken: string;
  let templateId: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean previous test data
    await Organization.deleteMany({ slug: "checklist-test-org" });

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    const org = await Organization.create({
      name: "Checklist Test Org",
      slug: "checklist-test-org",
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      departments: [{ name: "Engineering", active: true }],
    });
    testOrgId = org._id.toString();

    // 2. Create Admin user
    const passwordHash = await hashPassword("ChecklistSecret123!");
    const adminUser = await User.create({
      organizationId: org._id,
      auth: { email: "admin@checklist-test.com", passwordHash, emailVerified: true },
      profile: { firstName: "Admin", lastName: "Checklist", fullName: "Admin Checklist" },
      permissions: { role: "admin", customRoles: [] },
      isDeleted: false,
    });
    adminId = adminUser._id.toString();

    // 3. Login
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: "admin@checklist-test.com", password: "ChecklistSecret123!" },
    });
    const loginBody = JSON.parse(loginRes.body);
    adminToken = loginBody.data?.accessToken;
  });

  afterAll(async () => {
    await RoleChecklistTemplate.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Task.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await User.deleteMany({ organizationId: new mongoose.Types.ObjectId(testOrgId) });
    await Organization.deleteMany({ _id: new mongoose.Types.ObjectId(testOrgId) });
    await app.close();
  });

  it("Test 1: createTemplate stores items with relative day offsets and audience filters", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/tasks/templates",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: "Engineering Onboarding Playbook",
        description: "Standard ramp-up for software developers",
        audience: {
          roles: ["employee"],
          departments: ["Engineering"],
          autoAssignNewHires: true,
        },
        items: [
          {
            title: "Prerequisite: IT Hardware Receipt Verification",
            category: "it_setup",
            stage: "day_1",
            priority: "high",
            relativeOffsetDays: 0,
            requiresVerification: true,
          },
          {
            title: "Dependent: Local Environment Setup",
            category: "it_setup",
            stage: "day_1",
            priority: "normal",
            relativeOffsetDays: 2,
            prerequisiteItemIndex: 0, // Links to previous item
          },
          {
            title: "30-Day Checkpoint",
            category: "general",
            stage: "month_1",
            priority: "normal",
            relativeOffsetDays: 30,
          },
        ],
        isActive: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data._id).toBeDefined();
    templateId = body.data._id;

    const savedTemplate = await RoleChecklistTemplate.findById(templateId);
    expect(savedTemplate).toBeDefined();
    expect(savedTemplate?.items).toHaveLength(3);
    expect(savedTemplate?.items[1].relativeOffsetDays).toBe(2);
    expect(savedTemplate?.audience.departmentNames).toContain("Engineering");
  });

  it("Test 2: autoAssignRoleChecklistsToNewHire matches role 'employee' and dept 'Engineering'", async () => {
    // Create an engineering new hire
    const passwordHash = await hashPassword("Welcome123!");
    const newHire = await User.create({
      organizationId: new mongoose.Types.ObjectId(testOrgId),
      auth: { email: "dev.newhire@checklist-test.com", passwordHash, emailVerified: true },
      profile: { firstName: "Dev", lastName: "Newhire", fullName: "Dev Newhire" },
      employment: { department: "Engineering", status: "active", hireDate: new Date() },
      permissions: { role: "employee", customRoles: [] },
      isDeleted: false,
    });

    const result = await roleChecklistService.autoAssignRoleChecklistsToNewHire(
      testOrgId,
      newHire._id,
      { creatorId: adminId }
    );

    expect(result.assignedTemplatesCount).toBeGreaterThanOrEqual(1);
    expect(result.assignedTasksCount).toBe(3);

    // Verify tasks exist in database
    const userTasks = await Task.find({
      organizationId: new mongoose.Types.ObjectId(testOrgId),
      assignedToUserId: newHire._id,
    }).sort({ relativeOffsetDays: 1 });

    expect(userTasks).toHaveLength(3);
  });

  it("Test 3: Generated Task documents have dueDate set to now() + relativeOffsetDays", async () => {
    const user = await User.findOne({
      "auth.email": "dev.newhire@checklist-test.com",
      organizationId: new mongoose.Types.ObjectId(testOrgId),
    });
    expect(user).toBeDefined();

    const tasks = await Task.find({
      organizationId: new mongoose.Types.ObjectId(testOrgId),
      assignedToUserId: user?._id,
    });

    const day30Task = tasks.find((t) => t.title === "30-Day Checkpoint");
    expect(day30Task).toBeDefined();
    expect(day30Task?.dueDate).toBeDefined();

    const now = new Date();
    const diffDays = Math.round(
      (new Date(day30Task!.dueDate!).getTime() - now.getTime()) / (86400 * 1000)
    );
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it("Test 4: Prerequisite task dependency IDs are correctly resolved", async () => {
    const user = await User.findOne({
      "auth.email": "dev.newhire@checklist-test.com",
      organizationId: new mongoose.Types.ObjectId(testOrgId),
    });
    const tasks = await Task.find({
      organizationId: new mongoose.Types.ObjectId(testOrgId),
      assignedToUserId: user?._id,
    });

    const prereqTask = tasks.find((t) => t.title.includes("Prerequisite"));
    const dependentTask = tasks.find((t) => t.title.includes("Dependent"));

    expect(prereqTask).toBeDefined();
    expect(dependentTask).toBeDefined();
    expect(dependentTask?.prerequisiteTaskIds).toBeDefined();
    expect(dependentTask?.prerequisiteTaskIds.map((id) => id.toString())).toContain(
      prereqTask?._id.toString()
    );
  });
});
