import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import crypto from "crypto";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Task from "../modules/tasks/models/task.model.js";
import TaskService from "../modules/tasks/services/task.service.js";
import TaskRepository from "../modules/tasks/repositories/task.repository.js";
import eventBus from "../infrastructure/events/event-bus.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";
import Notification from "../modules/notifications/models/notification.model.js";
import DocumentTemplate from "../modules/documents/models/document-template.model.js";
import DocumentAssignment from "../modules/documents/models/document-assignment.model.js";
import documentService from "../modules/documents/services/document.service.js";

describe("Phase 5 — Autonomous Compliance & Cryptographic Task Verification Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let managerUser: any;
  let employeeUser: any;
  let taskService: TaskService;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Register all platform event subscribers
    registerEventSubscribers();

    taskService = new TaskService(new TaskRepository());

    const dummyId = new mongoose.Types.ObjectId();

    // Create test organization
    testOrg = await Organization.create({
      name: "Compliance Sentinel Test Org",
      slug: `sentinel-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // Create Manager User
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-compliance-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Sarah", lastName: "Manager" },
      permissions: { role: "manager" },
      employment: { status: "active", hireDate: new Date() },
    });

    // Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-compliance-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Alex", lastName: "Admin" },
      permissions: { role: "admin" },
      employment: { status: "active", hireDate: new Date() },
    });

    // Create Employee User reporting to managerUser
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `emp-compliance-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "David", lastName: "Frontline" },
      permissions: { role: "employee" },
      employment: {
        status: "active",
        hireDate: new Date(),
        managerId: managerUser._id,
      },
    });
  }, 20000);

  afterAll(async () => {
    if (testOrg?._id) {
      await Task.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await DocumentAssignment.deleteMany({ organizationId: testOrg._id });
      await DocumentTemplate.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  // =========================================================================
  // TEST 1: Document Signing with Valid SHA-256 Checksum Auto-Verifies Task
  // =========================================================================
  it("1. should autonomously verify task upon receiving valid DOCUMENT_SIGNED SHA-256 event", async () => {
    // 1. Create NDA Document Template
    const template = await DocumentTemplate.create({
      organizationId: testOrg._id,
      title: "Mutual NDA & IP Agreement",
      category: "nda",
      content: "This is a confidential agreement between {{organizationName}} and {{employeeName}}.",
      version: 1,
      signatureType: "draw",
      isMandatory: true,
      createdBy: adminUser._id,
      isActive: true,
    });

    // 2. Create Task with autoVerification configured for this template
    const task = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Sign Mutual Non-Disclosure Agreement",
      category: "hr_paperwork",
      stage: "day_1",
      priority: "critical",
      status: "pending",
      requiresVerification: true,
      autoVerification: {
        enabled: true,
        ruleType: "document_signed",
        linkedEntityId: template._id,
        entityModel: "DocumentTemplate",
      },
      statusHistory: [
        {
          status: "pending",
          changedBy: adminUser._id,
          actingRole: "admin",
          changedAt: new Date(),
          note: "Task created",
        },
      ],
    });

    // 3. Assign document to employee
    const assignment = await documentService.assignDocument(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    // 4. Employee e-signs document -> publishes DOCUMENT_SIGNED with real SHA-256 hash
    await documentService.signDocument(
      testOrg._id,
      assignment._id,
      employeeUser._id,
      {
        type: "draw",
        signatureDataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...",
        signerName: "David Frontline",
      },
      { ipAddress: "192.168.1.100", userAgent: "Mozilla/5.0" }
    );

    // Allow event bus asynchronous propagation
    await new Promise((resolve) => setTimeout(resolve, 800));

    // 5. Inspect task status
    const verifiedTask = await Task.findById(task._id);
    expect(verifiedTask).not.toBeNull();
    expect(verifiedTask?.status).toBe("verified");
    expect(verifiedTask?.verifiedAt).toBeDefined();
    expect(verifiedTask?.autoVerification?.verifiedHash).toBeDefined();
    expect(verifiedTask?.autoVerification?.verifiedHash?.length).toBe(64);
    expect(verifiedTask?.autoVerification?.verificationAuditNote).toContain("Autonomous Verification: Cryptographically confirmed via SHA-256");

    // Check status history audit entry
    const latestHistory = verifiedTask?.statusHistory[verifiedTask.statusHistory.length - 1];
    expect(latestHistory?.status).toBe("verified");
    expect(latestHistory?.changedBy).toBe("system.autonomous.sentinel");
    expect(latestHistory?.actingRole).toBe("system.autonomous.sentinel");
  }, 15000);

  // =========================================================================
  // TEST 2: Quiz Score Threshold Auto-Verification
  // =========================================================================
  it("2. should verify task only when quiz score meets or exceeds minimum threshold", async () => {
    const quizId = new mongoose.Types.ObjectId();

    // Create task requiring 80% passing score
    const task = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Complete Security & Phishing Awareness Quiz",
      category: "training",
      stage: "week_1",
      priority: "high",
      status: "pending",
      requiresVerification: true,
      autoVerification: {
        enabled: true,
        ruleType: "quiz_passed",
        linkedEntityId: quizId,
        entityModel: "Quiz",
        minScorePercent: 80,
      },
      statusHistory: [],
    });

    // Case A: Submit 75% score (failing threshold)
    await eventBus.publish({
      eventName: "QUIZ_COMPLETED",
      organizationId: testOrg._id,
      actorId: employeeUser._id,
      entityId: quizId,
      payload: {
        quizId: quizId.toString(),
        employeeId: employeeUser._id.toString(),
        score: 75,
        scorePercent: 75,
        passingScore: 80,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const taskAfterFail = await Task.findById(task._id);
    expect(taskAfterFail?.status).toBe("pending"); // MUST remain unverified

    // Case B: Re-take quiz and score 85% (passing threshold)
    await eventBus.publish({
      eventName: "QUIZ_COMPLETED",
      organizationId: testOrg._id,
      actorId: employeeUser._id,
      entityId: quizId,
      payload: {
        quizId: quizId.toString(),
        employeeId: employeeUser._id.toString(),
        score: 85,
        scorePercent: 85,
        passingScore: 80,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const taskAfterPass = await Task.findById(task._id);
    expect(taskAfterPass?.status).toBe("verified");
    expect(taskAfterPass?.verifiedAt).toBeDefined();

    const latestHistory = taskAfterPass?.statusHistory[taskAfterPass.statusHistory.length - 1];
    expect(latestHistory?.status).toBe("verified");
    expect(latestHistory?.changedBy).toBe("system.autonomous.sentinel");
    expect(latestHistory?.note).toContain("Confirmed passing score 85% >= 80%");
  }, 15000);

  // =========================================================================
  // TEST 3: Cryptographic Anomaly Quarantine & Manager Alert
  // =========================================================================
  it("3. should suppress verification, flag task as needs_review, and alert manager if SHA-256 hash is invalid or missing", async () => {
    const tamperedTemplateId = new mongoose.Types.ObjectId();

    const task = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Sign Direct Deposit Banking Authorization",
      category: "hr_paperwork",
      stage: "day_1",
      priority: "high",
      status: "pending",
      requiresVerification: true,
      autoVerification: {
        enabled: true,
        ruleType: "document_signed",
        linkedEntityId: tamperedTemplateId,
        entityModel: "DocumentTemplate",
      },
      statusHistory: [],
    });

    // Simulate corrupted or spoofed signature event with truncated / invalid hash
    await eventBus.publish({
      eventName: "DOCUMENT_SIGNED",
      organizationId: testOrg._id,
      actorId: employeeUser._id,
      entityId: tamperedTemplateId,
      payload: {
        templateId: tamperedTemplateId.toString(),
        templateTitle: "Direct Deposit Authorization",
        employeeId: employeeUser._id.toString(),
        signatureHash: "tampered_invalid_hex_string_123", // Invalid SHA-256 (not 64-char hex)
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 600));

    const quarantinedTask = await Task.findById(task._id);
    expect(quarantinedTask?.status).toBe("needs_review");
    expect(quarantinedTask?.quarantineReason).toContain("Cryptographic signature anomaly: Invalid or missing SHA-256 digest");

    const history = quarantinedTask?.statusHistory[quarantinedTask.statusHistory.length - 1];
    expect(history?.status).toBe("needs_review");
    expect(history?.changedBy).toBe("system.autonomous.sentinel");

    // Verify manager notification was dispatched
    const alert = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: managerUser._id,
      type: "journey_overdue",
    }).sort({ createdAt: -1 });

    expect(alert).not.toBeNull();
    expect(alert?.title).toContain("Task Verification Anomaly Alert");
    expect(alert?.message).toContain("quarantined");
  }, 15000);

  // =========================================================================
  // TEST 4: Audit Integrity (Human Manager vs Autonomous Sentinel)
  // =========================================================================
  it("4. should maintain audit integrity distinguishing human manager verification from autonomous sentinel", async () => {
    // Create manual task verified by human manager
    const manualTask = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Review Day 1 Code PR Submission",
      category: "training",
      stage: "day_1",
      priority: "normal",
      status: "completed",
      requiresVerification: true,
      autoVerification: {
        enabled: false, // Strictly manual
      },
      statusHistory: [],
    });

    // Manager manually verifies the task
    const managerVerified = await taskService.updateTaskStatus(
      manualTask._id,
      testOrg._id,
      managerUser._id,
      "verified",
      "PR code quality meets standard; manual sign-off complete",
      "manager"
    );

    expect(managerVerified.status).toBe("verified");
    expect(managerVerified.verifiedBy?.toString()).toBe(managerUser._id.toString());

    const managerHistory = managerVerified.statusHistory[managerVerified.statusHistory.length - 1];
    expect(managerHistory.changedBy?.toString()).toBe(managerUser._id.toString());
    expect(managerHistory.actingRole).toBe("manager");
    expect(managerHistory.note).toContain("manual sign-off complete");
  }, 15000);

  // =========================================================================
  // TEST 5: Guardrail: Qualitative & Physical Tasks Remain Strictly Manual
  // =========================================================================
  it("5. should prevent automated verification on qualitative or physical tasks", async () => {
    const physicalTask = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Conduct In-Person Ergonomic Desk Inspection",
      category: "equipment",
      stage: "day_1",
      priority: "normal",
      status: "pending",
      requiresVerification: true,
      autoVerification: {
        enabled: false, // Guardrail enforced
      },
      statusHistory: [],
    });

    // Employee cannot verify their own task
    await expect(
      taskService.updateTaskStatus(
        physicalTask._id,
        testOrg._id,
        employeeUser._id,
        "verified",
        "Self verify attempt",
        "employee"
      )
    ).rejects.toThrow("Regular employees cannot verify tasks requiring manager sign-off");

    // Random events must not affect it
    await eventBus.publish({
      eventName: "DOCUMENT_SIGNED",
      organizationId: testOrg._id,
      actorId: employeeUser._id,
      payload: {
        templateId: new mongoose.Types.ObjectId().toString(),
        employeeId: employeeUser._id.toString(),
        signatureHash: crypto.createHash("sha256").update("test").digest("hex"),
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 400));

    const untouchedTask = await Task.findById(physicalTask._id);
    expect(untouchedTask?.status).toBe("pending");
  }, 15000);

  // =========================================================================
  // TEST 6: Manager Override & Revocation Capability
  // =========================================================================
  it("6. should allow managers to revoke verification if quality issues are discovered", async () => {
    // Create an auto-verified task
    const fakeHash = crypto.createHash("sha256").update("compliance-doc").digest("hex");
    const task = await Task.create({
      organizationId: testOrg._id,
      createdBy: adminUser._id,
      assignedToUserId: employeeUser._id,
      employeeId: employeeUser._id,
      title: "Upload Government Photo ID",
      category: "hr_paperwork",
      stage: "day_1",
      priority: "high",
      status: "verified",
      verifiedAt: new Date(),
      autoVerification: {
        enabled: true,
        ruleType: "form_submitted",
        verifiedHash: fakeHash,
      },
      statusHistory: [
        {
          status: "verified",
          changedBy: "system.autonomous.sentinel",
          actingRole: "system.autonomous.sentinel",
          changedAt: new Date(),
          note: "Autonomous Verification",
        },
      ],
    });

    // Manager revokes verification due to blurry scan
    const revokedTask = await taskService.updateTaskStatus(
      task._id,
      testOrg._id,
      managerUser._id,
      "revision_requested",
      "Uploaded ID card is blurry and unreadable; please re-upload clear photo.",
      "manager"
    );

    expect(revokedTask.status).toBe("revision_requested");
    expect(revokedTask.verifiedAt).toBeNull();
    expect(revokedTask.verifiedBy).toBeNull();

    const revocationHistory = revokedTask.statusHistory[revokedTask.statusHistory.length - 1];
    expect(revocationHistory.status).toBe("revision_requested");
    expect(revocationHistory.changedBy?.toString()).toBe(managerUser._id.toString());
    expect(revocationHistory.note).toContain("Uploaded ID card is blurry");
  }, 15000);
});
