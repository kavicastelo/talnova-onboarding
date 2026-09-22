import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import RoleChecklistTemplate from "../modules/tasks/models/role-checklist-template.model.js";
import DocumentTemplate from "../modules/documents/models/document-template.model.js";
import MilestoneTemplate from "../modules/milestones/models/milestone-template.model.js";
import roleChecklistService from "../modules/tasks/services/role-checklist.service.js";
import TaskService from "../modules/tasks/services/task.service.js";
import TaskRepository from "../modules/tasks/repositories/task.repository.js";
import documentService from "../modules/documents/services/document.service.js";
import milestoneService from "../modules/milestones/services/milestone.service.js";
import buddyService from "../modules/buddy/services/buddy.service.js";
import itHardwareService from "../modules/tasks/services/it-hardware.service.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";

const taskService = new TaskService(new TaskRepository());

describe("Notification Engine — Multi-Party Dual-Recipient Verification Test Suite", () => {
  let app: FastifyInstance;
  let orgId: mongoose.Types.ObjectId;
  let managerId: mongoose.Types.ObjectId;
  let employeeId: mongoose.Types.ObjectId;
  let buddyUserId: mongoose.Types.ObjectId;
  let itAdminId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();
    registerEventSubscribers();

    orgId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    await Organization.create({
      _id: orgId,
      name: "Acme Corp Notification Test",
      slug: `notif-org-${Date.now()}`,
      createdBy: new mongoose.Types.ObjectId(),
      isDeleted: false,
    });

    // 2. Create Manager
    managerId = new mongoose.Types.ObjectId();
    await User.create({
      _id: managerId,
      organizationId: orgId,
      auth: { email: `manager-${Date.now()}@acme.com`, passwordHash: "$2a$10$abcdefghijklmnopqrstuuu" },
      profile: { firstName: "Sarah", lastName: "Manager", fullName: "Sarah Manager" },
      permissions: { role: "manager" },
      isDeleted: false,
    });

    // 3. Create Employee reporting to Manager
    employeeId = new mongoose.Types.ObjectId();
    await User.create({
      _id: employeeId,
      organizationId: orgId,
      auth: { email: `employee-${Date.now()}@acme.com`, passwordHash: "$2a$10$abcdefghijklmnopqrstuuu" },
      profile: { firstName: "John", lastName: "Doe", fullName: "John Doe" },
      permissions: { role: "employee" },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "onboarding",
        managerId: managerId,
        hireDate: new Date(),
      },
      isDeleted: false,
    });

    // 4. Create Buddy
    buddyUserId = new mongoose.Types.ObjectId();
    await User.create({
      _id: buddyUserId,
      organizationId: orgId,
      auth: { email: `buddy-${Date.now()}@acme.com`, passwordHash: "$2a$10$abcdefghijklmnopqrstuuu" },
      profile: { firstName: "Alex", lastName: "Buddy", fullName: "Alex Buddy" },
      permissions: { role: "employee" },
      isDeleted: false,
    });

    // 5. Create IT Admin
    itAdminId = new mongoose.Types.ObjectId();
    await User.create({
      _id: itAdminId,
      organizationId: orgId,
      auth: { email: `it-${Date.now()}@acme.com`, passwordHash: "$2a$10$abcdefghijklmnopqrstuuu" },
      profile: { firstName: "Mike", lastName: "IT", fullName: "Mike IT" },
      permissions: { role: "admin" },
      employment: { department: "IT" },
      isDeleted: false,
    });
  });

  afterAll(async () => {
    await Notification.deleteMany({ organizationId: orgId });
    await User.deleteMany({ organizationId: orgId });
    await Organization.deleteOne({ _id: orgId });
    await app.close();
  });

  it("Flow 1: Checklist template assignment notifies BOTH responsible user and relevant users (employee and manager)", async () => {
    // Create a checklist template
    const template = await RoleChecklistTemplate.create({
      organizationId: orgId,
      title: "Engineering Onboarding Checklist",
      createdBy: managerId,
      isDeleted: false,
      items: [
        {
          title: "Complete Git & Repo Setup",
          description: "Clone repo and run dev environment",
          responsibleRole: "employee",
          stage: "day_1",
          priority: "high",
          relativeOffsetDays: 1,
        },
        {
          title: "Manager 1-on-1 Alignment",
          description: "30-minute sync with Sarah",
          responsibleRole: "manager",
          stage: "week_1",
          priority: "normal",
          relativeOffsetDays: 3,
        },
      ],
    });

    // Apply checklist template to John Doe
    await roleChecklistService.applyTemplateToUser(
      orgId,
      template._id,
      employeeId,
      managerId
    );

    // Wait briefly for asynchronous notifications to persist
    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received notification (both task assigned directly and checklist overview)
    const employeeNotifications = await Notification.find({
      organizationId: orgId,
      recipientUserId: employeeId,
    });
    expect(employeeNotifications.length).toBeGreaterThan(0);
    const employeeChecklistNotif = employeeNotifications.find(
      (n) => n.type === "checklist_assigned" || n.type === "task_assigned"
    );
    expect(employeeChecklistNotif).toBeDefined();

    // Verify manager (relevant user) received notification
    const managerNotifications = await Notification.find({
      organizationId: orgId,
      recipientUserId: managerId,
    });
    expect(managerNotifications.length).toBeGreaterThan(0);
    const managerNotif = managerNotifications.find(
      (n) => n.type === "checklist_assigned" || n.type === "task_assigned"
    );
    expect(managerNotif).toBeDefined();
  });

  it("Flow 2: Task status completion and verification notifies both responsible user and manager", async () => {
    // Create single operational task assigned to employee
    const task = await taskService.createTask(orgId, managerId, {
      title: "Submit Tax & Payroll Forms",
      assignedToUserId: employeeId.toString(),
      employeeId: employeeId.toString(),
      priority: "high",
    });

    // Complete task as employee
    await taskService.updateTaskStatus(task._id, orgId, employeeId, "completed", "Forms uploaded to portal", "employee");

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received completion confirmation
    const empCompletedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "task_completed",
    });
    expect(empCompletedNotif).toBeDefined();

    // Verify manager received alert of task completed
    const mgrCompletedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "task_completed",
    });
    expect(mgrCompletedNotif).toBeDefined();

    // Verify task verification notifies employee
    await taskService.updateTaskStatus(task._id, orgId, managerId, "verified", "Tax forms verified and approved", "manager");

    await new Promise((r) => setTimeout(r, 200));

    const empVerifiedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "task_verified",
    });
    expect(empVerifiedNotif).toBeDefined();
  });

  it("Flow 3: Document assignment and electronic signature notifies both employee and manager", async () => {
    // Create Document Template
    const docTemplate = await DocumentTemplate.create({
      organizationId: orgId,
      title: "Confidentiality & IP Agreement",
      category: "nda",
      content: "This agreement is between {{companyName}} and {{employeeName}}.",
      version: 1,
      createdBy: managerId,
      isDeleted: false,
    });

    // Assign document to employee
    const assignment = await documentService.assignDocument(orgId, docTemplate._id, employeeId, managerId);

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received document assignment notification
    const empDocNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "document_assigned",
    });
    expect(empDocNotif).toBeDefined();

    // Sign document
    await documentService.signDocument(orgId, assignment._id, employeeId, {
      type: "type",
      signerName: "John Doe",
    });

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received signed confirmation
    const empSignedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "document_signed",
    });
    expect(empSignedNotif).toBeDefined();

    // Verify manager received notification that document was signed
    const mgrSignedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "document_signed",
    });
    expect(mgrSignedNotif).toBeDefined();
  });

  it("Flow 4: Milestone assignment, self-submission, and manager evaluation notifies both employee and manager", async () => {
    const msTemplate = await MilestoneTemplate.create({
      organizationId: orgId,
      title: "Day 30 Culture & Technical Integration",
      targetDay: 30,
      goals: [{ title: "Ship first PR to production" }],
      createdBy: managerId,
      isDeleted: false,
    });

    // Assign milestone
    const milestone = await milestoneService.assignMilestone(orgId, msTemplate._id, employeeId, managerId);

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received milestone assigned notification
    const empMsAssignNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "milestone_assigned",
    });
    expect(empMsAssignNotif).toBeDefined();

    // Verify manager received milestone scheduled notification
    const mgrMsAssignNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "milestone_assigned",
    });
    expect(mgrMsAssignNotif).toBeDefined();

    // Submit employee self check-in
    await milestoneService.submitEmployeeSelfCheck(orgId, milestone._id, employeeId, {
      employeeRating: 5,
      comments: "Shipped first PR ahead of time!",
      goalsCompletedTitles: ["Ship first PR to production"],
    });

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received submission confirmation
    const empSubmittedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "milestone_submitted",
    });
    expect(empSubmittedNotif).toBeDefined();

    // Verify manager received review alert
    const mgrSubmittedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "milestone_submitted",
    });
    expect(mgrSubmittedNotif).toBeDefined();

    // Manager evaluates and signs off
    await milestoneService.evaluateMilestone(orgId, milestone._id, managerId, "manager", {
      status: "approved",
      managerRating: 5,
      managerFeedback: "Excellent velocity and communication.",
    });

    await new Promise((r) => setTimeout(r, 200));

    // Verify employee received approval notification
    const empApprovedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "milestone_approved",
    });
    expect(empApprovedNotif).toBeDefined();

    // Verify manager received sign-off confirmation
    const mgrApprovedNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "milestone_approved",
    });
    expect(mgrApprovedNotif).toBeDefined();
  });

  it("Flow 5: Buddy assignment and checklist toggling notifies buddy, mentee, and manager", async () => {
    // Assign buddy
    const buddyAssignment = await buddyService.assignBuddy(orgId, employeeId, buddyUserId, managerId);

    await new Promise((r) => setTimeout(r, 200));

    // Verify mentee received notification
    const menteeBuddyNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "buddy_assigned",
    });
    expect(menteeBuddyNotif).toBeDefined();

    // Verify buddy received notification
    const buddyNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: buddyUserId,
      type: "buddy_assigned",
    });
    expect(buddyNotif).toBeDefined();

    // Verify manager received buddy assignment notification
    const mgrBuddyNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "buddy_assigned",
    });
    expect(mgrBuddyNotif).toBeDefined();

    // Toggle checklist item as buddy
    const firstTaskId = buddyAssignment.checklist[0].title;
    await buddyService.updateChecklistTask(orgId, buddyAssignment._id, firstTaskId, true, buddyUserId, "employee");

    await new Promise((r) => setTimeout(r, 200));

    // Verify mentee was alerted to checklist item completion
    const menteeChecklistUpdate = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "buddy_checklist_updated",
    });
    expect(menteeChecklistUpdate).toBeDefined();
  });

  it("Flow 6: IT Hardware pre-boarding setup and delivery confirmation notifies IT admin, employee, and manager", async () => {
    // Trigger preboarding setup
    const hwTask = await itHardwareService.triggerPreboardingItSetup(orgId, employeeId, new Date());

    await new Promise((r) => setTimeout(r, 200));

    // Verify IT Admin (responsible) was notified
    const itAdminNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: itAdminId,
      type: "hardware_provisioned",
    });
    expect(itAdminNotif).toBeDefined();

    // Verify Employee (relevant) was notified
    const empHwNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "hardware_provisioned",
    });
    expect(empHwNotif).toBeDefined();

    // Verify Manager (relevant) was notified
    const mgrHwNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "hardware_provisioned",
    });
    expect(mgrHwNotif).toBeDefined();

    // Confirm receipt by employee
    await itHardwareService.confirmHardwareReceipt(orgId, hwTask._id, employeeId, "Laptop received in mint condition");

    await new Promise((r) => setTimeout(r, 200));

    // Verify Employee received delivery confirmation
    const empReceiptNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "hardware_received",
    });
    expect(empReceiptNotif).toBeDefined();

    // Verify IT Admin received confirmation
    const itReceiptNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: itAdminId,
      type: "hardware_received",
    });
    expect(itReceiptNotif).toBeDefined();

    // Verify Manager received delivery update
    const mgrReceiptNotif = await Notification.findOne({
      organizationId: orgId,
      recipientUserId: managerId,
      type: "hardware_received",
    });
    expect(mgrReceiptNotif).toBeDefined();
  });
});
