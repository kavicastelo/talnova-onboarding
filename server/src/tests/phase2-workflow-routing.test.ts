import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import WorkflowRule from "../modules/workflows/models/workflow-rule.model.js";
import WorkflowExecutionLog from "../modules/workflows/models/workflow-execution.model.js";
import workflowEngine from "../modules/workflows/services/workflow.engine.js";
import Journey from "../modules/journeys/models/journey.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import queueService from "../infrastructure/queue/queue.service.js";
import eventBus from "../infrastructure/events/event-bus.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";

describe("Phase 2 — Intelligent Workflow Routing & Conflict Arbitration Engine", () => {
  let app: FastifyInstance;
  let orgId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();
    registerEventSubscribers();

    orgId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();

    await Organization.create({
      _id: orgId,
      name: "Workflow Routing Corp",
      slug: `wf-routing-${Date.now()}`,
      departments: [
        { _id: new mongoose.Types.ObjectId(), name: "Engineering", active: true },
        { _id: new mongoose.Types.ObjectId(), name: "Marketing", active: true },
      ],
      active: true,
      createdBy: adminId,
    });

    await User.create({
      _id: adminId,
      organizationId: orgId,
      auth: { email: `admin-${Date.now()}@routing.corp`, passwordHash: "dummyHash" },
      profile: { firstName: "Admin", lastName: "Owner", fullName: "Admin Owner" },
      permissions: { role: "admin", customRoles: [] },
      employment: { status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });
  });

  beforeEach(async () => {
    await WorkflowRule.deleteMany({ organizationId: orgId });
    await WorkflowExecutionLog.deleteMany({ organizationId: orgId });
    await Journey.deleteMany({ organizationId: orgId });
    await EmployeeAssignment.deleteMany({ organizationId: orgId });
    await Task.deleteMany({ organizationId: orgId });
    await AuditLog.deleteMany({ organizationId: orgId });
  });

  afterAll(async () => {
    await WorkflowRule.deleteMany({ organizationId: orgId });
    await WorkflowExecutionLog.deleteMany({ organizationId: orgId });
    await Journey.deleteMany({ organizationId: orgId });
    await EmployeeAssignment.deleteMany({ organizationId: orgId });
    await Task.deleteMany({ organizationId: orgId });
    await AuditLog.deleteMany({ organizationId: orgId });
    await User.deleteMany({ organizationId: orgId });
    await Organization.deleteMany({ _id: orgId });
    await disconnectDatabase();
    if (app) await app.close();
  });

  it("1. Deterministic Rule Arbitration Test (Resolves UQ-06): Most recent rule wins and writes AuditLog", async () => {
    // Create two published journey templates
    const journeyA = await Journey.create({
      organizationId: orgId,
      title: "Journey A (Legacy)",
      slug: `journey-a-${Date.now()}`,
      description: "Legacy Onboarding Roadmap",
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    const journeyB = await Journey.create({
      organizationId: orgId,
      title: "Journey B (Modern)",
      slug: `journey-b-${Date.now()}`,
      description: "Modern Onboarding Roadmap",
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // Create Rule A (T1) and Rule B (T2, updated later) with identical priority 100
    const ruleA = await WorkflowRule.create({
      organizationId: orgId,
      name: "Engineering Rule A",
      triggerType: "user_created",
      priority: 100,
      conditions: [{ field: "department", operator: "equals", value: "Engineering" }],
      actions: [{ type: "assign_journey", params: { journeyId: journeyA._id.toString() } }],
      isActive: true,
      createdBy: adminId,
      updatedAt: new Date(Date.now() - 10000), // older
    });

    const ruleB = await WorkflowRule.create({
      organizationId: orgId,
      name: "Engineering Rule B",
      triggerType: "user_created",
      priority: 100,
      conditions: [{ field: "department", operator: "equals", value: "Engineering" }],
      actions: [{ type: "assign_journey", params: { journeyId: journeyB._id.toString() } }],
      isActive: true,
      createdBy: adminId,
      updatedAt: new Date(Date.now()), // newer
    });

    // Create new engineer
    const engineer = await User.create({
      organizationId: orgId,
      auth: { email: `dev-${Date.now()}@routing.corp`, passwordHash: "dummy" },
      profile: { firstName: "Dev", lastName: "Alice", fullName: "Dev Alice" },
      permissions: { role: "employee", customRoles: [] },
      employment: { department: "Engineering", status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });

    // Run workflow engine for user_created
    await workflowEngine.processEvent(orgId, "user_created", engineer._id);

    // Verify only ONE journey assignment was created and it belongs to Rule B
    const assignments = await EmployeeAssignment.find({
      organizationId: orgId,
      employeeId: engineer._id,
    });
    expect(assignments.length).toBe(1);
    expect(assignments[0].journey.journeyId.toString()).toBe(journeyB._id.toString());
    expect(assignments[0].journey.title).toBe("Journey B (Modern)");

    // Verify AuditLog entry for WORKFLOW_RULE_CONFLICT_ARBITRATED
    const arbitrationLog = await AuditLog.findOne({
      organizationId: orgId,
      eventType: "WORKFLOW_RULE_CONFLICT_ARBITRATED",
    });
    expect(arbitrationLog).toBeDefined();
    expect(arbitrationLog?.description).toContain("Engineering Rule B");
    expect(arbitrationLog?.metadata?.winningRuleId).toBe(ruleB._id.toString());
  });

  it("2. True Delay Action Execution Test: Execution pauses and resumes with persistent queue worker", async () => {
    // Create delayed workflow rule: Task 1 -> Delay 10 mins -> Task 2
    const delayedRule = await WorkflowRule.create({
      organizationId: orgId,
      name: "Delayed Provisioning Rule",
      triggerType: "task_completed",
      priority: 90,
      conditions: [],
      actions: [
        {
          type: "create_task",
          params: { taskTitle: "Immediate Setup Task", taskStage: "day_1" },
        },
        {
          type: "delay",
          params: { delayMinutes: 10 },
        },
        {
          type: "create_task",
          params: { taskTitle: "Delayed Follow-up Task", taskStage: "week_1" },
        },
      ],
      isActive: true,
      createdBy: adminId,
    });

    const user = await User.create({
      organizationId: orgId,
      auth: { email: `delayed-user-${Date.now()}@routing.corp`, passwordHash: "dummy" },
      profile: { firstName: "Delay", lastName: "Tester", fullName: "Delay Tester" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });

    // Process event
    await workflowEngine.processEvent(orgId, "task_completed", user._id);

    // Immediate Task should exist
    const immediateTask = await Task.findOne({
      organizationId: orgId,
      assignedToUserId: user._id,
      title: "Immediate Setup Task",
    });
    expect(immediateTask).toBeDefined();

    // Delayed Task should NOT exist yet
    const delayedTaskBefore = await Task.findOne({
      organizationId: orgId,
      assignedToUserId: user._id,
      title: "Delayed Follow-up Task",
    });
    expect(delayedTaskBefore).toBeNull();

    // Execution log should be paused_delay with nextStepIndex: 3
    const pausedLog = await WorkflowExecutionLog.findOne({
      organizationId: orgId,
      targetUserId: user._id,
      status: "paused_delay",
    });
    expect(pausedLog).toBeDefined();
    expect(pausedLog?.nextStepIndex).toBe(3);
    expect(pausedLog?.resumeAt).toBeDefined();

    // Trigger resumption worker via workflowEngine
    const resumed = await workflowEngine.resumeDelayedExecution(pausedLog!._id);
    expect(resumed).toBe(true);

    // Delayed task should now exist!
    const delayedTaskAfter = await Task.findOne({
      organizationId: orgId,
      assignedToUserId: user._id,
      title: "Delayed Follow-up Task",
    });
    expect(delayedTaskAfter).toBeDefined();

    // Execution log status should now be success
    const completedLog = await WorkflowExecutionLog.findById(pausedLog!._id);
    expect(completedLog?.status).toBe("success");
    expect(completedLog?.completedAt).toBeDefined();
  });

  it("3. No Split-Brain Duplicates Test: Custom rule overrides Audience auto-enrollment deterministically", async () => {
    // 1. Audience Auto-Enroll Journey (Base priority 50)
    const audienceJourney = await Journey.create({
      organizationId: orgId,
      title: "Audience Engineering Journey",
      slug: `audience-eng-${Date.now()}`,
      description: "Default Audience Journey",
      audience: {
        departmentNames: ["Engineering"],
        autoEnrollNewHires: true,
      },
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // 2. Custom Workflow Rule targeting Engineering (Priority 80 > 50)
    const customJourney = await Journey.create({
      organizationId: orgId,
      title: "Custom Priority Engineering Journey",
      slug: `custom-eng-${Date.now()}`,
      description: "Admin Custom Priority Journey",
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    await WorkflowRule.create({
      organizationId: orgId,
      name: "High Priority Engineering Journey Rule",
      triggerType: "user_created",
      priority: 80,
      conditions: [{ field: "department", operator: "equals", value: "Engineering" }],
      actions: [{ type: "assign_journey", params: { journeyId: customJourney._id.toString() } }],
      isActive: true,
      createdBy: adminId,
    });

    // Create user in Engineering
    const newHire = await User.create({
      organizationId: orgId,
      auth: { email: `hire-${Date.now()}@routing.corp`, passwordHash: "dummy" },
      profile: { firstName: "SplitBrain", lastName: "Check", fullName: "SplitBrain Check" },
      permissions: { role: "employee", customRoles: [] },
      employment: { department: "Engineering", status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });

    // Publish USER_CREATED through event bus
    await eventBus.publish("USER_CREATED", {
      organizationId: orgId.toString(),
      actorId: newHire._id.toString(),
      entityId: newHire._id.toString(),
      payload: { department: "Engineering" },
    });

    // Give asynchronous event subscribers time to complete
    await new Promise((r) => setTimeout(r, 500));

    // Verify EXACTLY 1 assignment was created
    const userAssignments = await EmployeeAssignment.find({
      organizationId: orgId,
      employeeId: newHire._id,
    });
    expect(userAssignments.length).toBe(1);
    expect(userAssignments[0].journey.journeyId.toString()).toBe(customJourney._id.toString());
  });

  it("4. Default Workspace Fallback Test (BR-WFK-003): Assigns default template when zero rules match", async () => {
    // Create workspace default journey
    const defaultJourney = await Journey.create({
      organizationId: orgId,
      title: "Company Default Onboarding Roadmap",
      slug: `default-roadmap-${Date.now()}`,
      description: "Standard roadmap for all roles without specific rules",
      isDefault: true,
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // Create user in undefined department "Logistics" with no matching rules
    const rogueHire = await User.create({
      organizationId: orgId,
      auth: { email: `rogue-${Date.now()}@routing.corp`, passwordHash: "dummy" },
      profile: { firstName: "Rogue", lastName: "Hire", fullName: "Rogue Hire" },
      permissions: { role: "employee", customRoles: [] },
      employment: { department: "Logistics", status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });

    await workflowEngine.processEvent(orgId, "user_created", rogueHire._id);

    const assignments = await EmployeeAssignment.find({
      organizationId: orgId,
      employeeId: rogueHire._id,
    });

    expect(assignments.length).toBe(1);
    expect(assignments[0].journey.journeyId.toString()).toBe(defaultJourney._id.toString());
    expect(assignments[0].source).toBe("workflow_engine");
  });

  it("5. Dynamic Profile Re-Evaluation & Manual Assignment Protection Test", async () => {
    // Create Marketing Journey
    const mktgJourney = await Journey.create({
      organizationId: orgId,
      title: "Marketing Specialists Roadmap",
      slug: `mktg-roadmap-${Date.now()}`,
      description: "Marketing Onboarding",
      audience: {
        departmentNames: ["Marketing"],
        autoEnrollNewHires: true,
      },
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // Create Engineering Department Journey
    const engDeptJourney = await Journey.create({
      organizationId: orgId,
      title: "Engineering Specialists Roadmap",
      slug: `eng-dept-roadmap-${Date.now()}`,
      description: "Engineering Onboarding",
      audience: {
        departmentNames: ["Engineering"],
        autoEnrollNewHires: true,
      },
      publishing: { status: "published", version: 1 },
      modules: [],
      createdBy: adminId,
    });

    // 1. Test automated assignment re-routing (<20% complete)
    const transferEmployee = await User.create({
      organizationId: orgId,
      auth: { email: `transfer-${Date.now()}@routing.corp`, passwordHash: "dummy" },
      profile: { firstName: "Transfer", lastName: "User", fullName: "Transfer User" },
      permissions: { role: "employee", customRoles: [] },
      employment: { department: "Engineering", status: "active", employmentType: "full_time" },
      createdBy: adminId,
    });

    // Assign initial journey via workflow_engine
    const autoAssignment = await EmployeeAssignment.create({
      organizationId: orgId,
      employeeId: transferEmployee._id,
      assignedBy: adminId,
      journey: { journeyId: engDeptJourney._id, title: engDeptJourney.title, version: 1 },
      assignment: { assignedAt: new Date(), priority: "normal" },
      status: "assigned",
      source: "workflow_engine",
      progress: {
        totalModules: 5,
        completedModules: 0,
        totalLessons: 10,
        completedLessons: 1,
        completionPercentage: 10, // < 20%
        totalTimeSpentSeconds: 100,
      },
      modules: [],
    });

    // Mutate department to Marketing
    transferEmployee.employment = { ...transferEmployee.employment, department: "Marketing" };
    await transferEmployee.save();

    // Publish department change event
    await eventBus.publish("USER_DEPARTMENT_CHANGED", {
      organizationId: orgId.toString(),
      actorId: transferEmployee._id.toString(),
      entityId: transferEmployee._id.toString(),
      payload: { department: "Marketing" },
    });

    await new Promise((r) => setTimeout(r, 500));

    // Old assignment should be expired
    const oldAssignment = await EmployeeAssignment.findById(autoAssignment._id);
    expect(oldAssignment?.status).toBe("expired");

    // New Marketing assignment should be active
    const newAssignment = await EmployeeAssignment.findOne({
      organizationId: orgId,
      employeeId: transferEmployee._id,
      status: "assigned",
    });
    expect(newAssignment).toBeDefined();
    expect(newAssignment?.journey.journeyId.toString()).toBe(mktgJourney._id.toString());

    // 2. Test Manual Assignment Protection (source === "manual" MUST NEVER be overridden)
    const manualAssignment = await EmployeeAssignment.create({
      organizationId: orgId,
      employeeId: transferEmployee._id,
      assignedBy: adminId,
      journey: { journeyId: engDeptJourney._id, title: engDeptJourney.title, version: 1 },
      assignment: { assignedAt: new Date(), priority: "high" },
      status: "assigned",
      source: "manual", // Manually assigned by Admin/Manager
      progress: {
        totalModules: 5,
        completedModules: 0,
        totalLessons: 10,
        completedLessons: 0,
        completionPercentage: 0, // 0% complete, but manual!
        totalTimeSpentSeconds: 0,
      },
      modules: [],
    });

    // Mutate department to Engineering again
    transferEmployee.employment = { ...transferEmployee.employment, department: "Engineering" };
    await transferEmployee.save();

    await eventBus.publish("USER_DEPARTMENT_CHANGED", {
      organizationId: orgId.toString(),
      actorId: transferEmployee._id.toString(),
      entityId: transferEmployee._id.toString(),
      payload: { department: "Engineering" },
    });

    await new Promise((r) => setTimeout(r, 500));

    // Manual assignment must still be assigned, NOT expired!
    const recheckedManual = await EmployeeAssignment.findById(manualAssignment._id);
    expect(recheckedManual?.status).toBe("assigned");
  });
});
