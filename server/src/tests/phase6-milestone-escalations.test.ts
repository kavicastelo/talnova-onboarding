import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import MilestoneTemplate from "../modules/milestones/models/milestone-template.model.js";
import EmployeeMilestone from "../modules/milestones/models/employee-milestone.model.js";
import milestoneService from "../modules/milestones/services/milestone.service.js";
import Notification from "../modules/notifications/models/notification.model.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";
import eventBus from "../infrastructure/events/event-bus.js";

describe("Phase 6 — Milestone Evaluations, Escalation Ladders & Auto-Approvals Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let managerUser: any;
  let skipLevelManager: any;
  let employeeUser: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    registerEventSubscribers();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Milestone SLA Test Org",
      slug: `milestone-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Skip-Level Manager (Director)
    skipLevelManager = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `director-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Eleanor", lastName: "Director" },
      permissions: { role: "admin" },
      employment: { status: "active", hireDate: new Date() },
    });

    // 3. Create Direct Manager reporting to Skip-Level Manager
    managerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `manager-m-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Marcus", lastName: "Lead" },
      permissions: { role: "manager" },
      employment: {
        status: "active",
        hireDate: new Date(),
        managerId: skipLevelManager._id,
      },
    });

    // 4. Create HR Admin
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `admin-hr-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Hannah", lastName: "HR" },
      permissions: { role: "admin" },
      employment: { status: "active", hireDate: new Date() },
    });

    // 5. Create Employee reporting to Marcus
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `emp-m-${Date.now()}@test.com`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuuu",
        emailVerified: true,
      },
      profile: { firstName: "Lucas", lastName: "RampUp" },
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
      await EmployeeMilestone.deleteMany({ organizationId: testOrg._id });
      await MilestoneTemplate.deleteMany({ organizationId: testOrg._id });
      await Notification.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    await app.close();
  });

  // =========================================================================
  // TEST 1: Auto-Approval SLA Test (Day 7 High-Confidence Approval)
  // =========================================================================
  it("1. should autonomously approve high-confidence milestone evaluation when manager breaches 7-day SLA", async () => {
    // 1. Create Template
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Day 30 Foundational Review",
      targetDay: 30,
      autoApprovalEnabled: true,
    });

    // 2. Assign milestone to employee
    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    // Track MILESTONE_COMPLETED event
    let milestoneCompletedEventFired = false;
    const unsub = eventBus.subscribe("MILESTONE_COMPLETED", (event) => {
      if (event.payload?.milestoneId === milestone._id.toString()) {
        milestoneCompletedEventFired = true;
      }
    });

    // 3. Employee submits high-confidence self-check (Rating: 5, 0 blockers)
    const submitted = await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      {
        employeeRating: 5,
        confidenceRating: 5,
        comments: "Onboarding has been incredibly smooth. Completed all Day 30 goals ahead of time and shipped my first production fix.",
        reflectionNotes: "Feeling very confident and supported by the team.",
      }
    );

    expect(submitted.status).toBe("pending_manager_review");
    expect(submitted.sla).toBeDefined();
    expect(submitted.sla?.autoApprovalEligible).toBe(true);
    expect(submitted.sla?.escalationState).toBe("normal");
    expect(submitted.aiSummary).toBeDefined();
    expect(submitted.aiSummary).toContain("Key Achievements");

    // 4. Simulate passage of 8 days without manager action
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    submitted.submittedAt = eightDaysAgo;
    if (submitted.sla) {
      submitted.sla.reviewDeadline = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day past deadline
    }
    await submitted.save();

    // 5. Trigger Autonomous Escalation Scanner
    const scanResult = await milestoneService.scanPendingMilestoneReviews(testOrg._id);
    expect(scanResult.autoApproved).toBeGreaterThanOrEqual(1);

    // 6. Verify autonomous approval
    const autoApprovedMilestone = await EmployeeMilestone.findById(milestone._id);
    expect(autoApprovedMilestone?.status).toBe("approved");
    expect(autoApprovedMilestone?.approvedBy).toBe("system.autonomous.sentinel");
    expect(autoApprovedMilestone?.managerRating).toBe(4);
    expect(autoApprovedMilestone?.managerFeedback).toContain("Autonomous Milestone Approval");
    expect(autoApprovedMilestone?.sla?.escalationState).toBe("auto_approved");

    // Verify downstream event emitted
    expect(milestoneCompletedEventFired).toBe(true);

    // Verify manager notification of auto-approval
    const managerNotif = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: managerUser._id,
      title: /Auto-Approved/,
    });
    expect(managerNotif).not.toBeNull();
  }, 15000);

  // =========================================================================
  // TEST 2: Low-Rating Human Guardrail Test (Auto-Approval Blocked & Escalated)
  // =========================================================================
  it("2. should strictly BLOCK auto-approval on low rating or reported blockers, escalating to skip-level / HR", async () => {
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Day 60 Technical Alignment",
      targetDay: 60,
      autoApprovalEnabled: true,
    });

    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    // Employee submits low rating (Rating: 2, Blockers reported)
    const submitted = await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      {
        employeeRating: 2,
        confidenceRating: 2,
        comments: "I am feeling stuck and facing major blockers with environment permissions. Need urgent assistance from the team.",
        reflectionNotes: "Struggling with toolchain setup.",
      }
    );

    expect(submitted.status).toBe("pending_manager_review");
    expect(submitted.sla?.autoApprovalEligible).toBe(false); // MUST be false
    expect(submitted.sla?.blockersReported).toBe(true);

    // Simulate passage of 8 days without manager action
    submitted.submittedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    if (submitted.sla) {
      submitted.sla.reviewDeadline = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    }
    await submitted.save();

    // Trigger scanner
    const scanResult = await milestoneService.scanPendingMilestoneReviews(testOrg._id);
    expect(scanResult.escalated).toBeGreaterThanOrEqual(1);

    // Verify auto-approval was BLOCKED
    const escalatedMilestone = await EmployeeMilestone.findById(milestone._id);
    expect(escalatedMilestone?.status).toBe("pending_manager_review"); // Did NOT auto-approve!
    expect(escalatedMilestone?.sla?.escalationState).toBe("escalated");
    expect(escalatedMilestone?.sla?.delegatedToUserId?.toString()).toBe(skipLevelManager._id.toString());

    // Verify Escalation Alert delivered to Skip-Level Manager
    const alertNotif = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: skipLevelManager._id,
      title: /Milestone Review Escalation Alert/,
    });
    expect(alertNotif).not.toBeNull();
    expect(alertNotif?.priority).toBe("critical");
    expect(alertNotif?.message).toContain("breached the 7-day manager SLA");
  }, 15000);

  // =========================================================================
  // TEST 3: Escalation Ladder (Day 3 Reminder & Day 5 Urgent 48h Alert)
  // =========================================================================
  it("3. should dispatch Day 3 gentle reminder and Day 5 urgent alert along escalation ladder", async () => {
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Day 90 Comprehensive Review",
      targetDay: 90,
      autoApprovalEnabled: true,
    });

    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    const submitted = await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      {
        employeeRating: 4,
        confidenceRating: 4,
        comments: "Making good steady progress across all engineering initiatives.",
      }
    );

    // Step A: Simulate 3.5 days elapsed
    submitted.submittedAt = new Date(Date.now() - 3.5 * 24 * 60 * 60 * 1000);
    await submitted.save();

    let scanResult = await milestoneService.scanPendingMilestoneReviews(testOrg._id);
    expect(scanResult.remindedLevel1).toBeGreaterThanOrEqual(1);

    const afterDay3 = await EmployeeMilestone.findById(milestone._id);
    expect(afterDay3?.sla?.reminderSentCount).toBe(1);
    expect(afterDay3?.sla?.escalationState).toBe("reminded");

    const day3Notif = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: managerUser._id,
      title: /Friendly Reminder/,
    });
    expect(day3Notif).not.toBeNull();

    // Step B: Simulate 5.5 days elapsed
    submitted.submittedAt = new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000);
    await submitted.save();

    scanResult = await milestoneService.scanPendingMilestoneReviews(testOrg._id);
    expect(scanResult.remindedLevel2).toBeGreaterThanOrEqual(1);

    const afterDay5 = await EmployeeMilestone.findById(milestone._id);
    expect(afterDay5?.sla?.reminderSentCount).toBe(2);

    const day5Notif = await Notification.findOne({
      organizationId: testOrg._id,
      recipientUserId: managerUser._id,
      title: /Overdue in 48 Hours/,
    });
    expect(day5Notif).not.toBeNull();
    expect(day5Notif?.priority).toBe("high");
  }, 15000);

  // =========================================================================
  // TEST 4: Manager Manual Evaluation Takes Precedence & Cancels SLA
  // =========================================================================
  it("4. should prioritize human manager review and cancel SLA escalation window", async () => {
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Day 30 Quick Sync",
      targetDay: 30,
    });

    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      { employeeRating: 5, comments: "Ready for manager review." }
    );

    // Manager signs off before SLA breach
    const reviewed = await milestoneService.evaluateMilestone(
      testOrg._id,
      milestone._id,
      managerUser._id,
      "manager",
      {
        status: "approved",
        managerRating: 5,
        managerFeedback: "Exceptional ramp-up velocity. Fully aligned on Q4 goals.",
      }
    );

    expect(reviewed.status).toBe("approved");
    expect(reviewed.approvedBy?.toString()).toBe(managerUser._id.toString());
    expect(reviewed.sla?.escalationState).toBe("normal");

    // Advance time and scan: must remain untouched
    reviewed.submittedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await reviewed.save();

    const scanResult = await milestoneService.scanPendingMilestoneReviews(testOrg._id);
    expect(scanResult.autoApproved).toBe(0);
    expect(scanResult.escalated).toBe(0);
  }, 15000);

  // =========================================================================
  // TEST 5: AI-Powered Reflection Summarization
  // =========================================================================
  it("5. should automatically generate concise 3-bullet briefing from long-form employee reflection", async () => {
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Day 60 Reflection Exercise",
      targetDay: 60,
    });

    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    const longFormComments =
      "During the past two months I have integrated deeply into the product engineering team. " +
      "I successfully delivered the payment webhooks refactor and ramped up on microservice architecture. " +
      "I faced initial friction understanding legacy database schemas, but my buddy helped me unblock. " +
      "I feel confident taking on independent on-call rotations next sprint.";

    const submitted = await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      {
        employeeRating: 4,
        confidenceRating: 4,
        comments: longFormComments,
      }
    );

    expect(submitted.aiSummary).toBeDefined();
    expect(submitted.aiSummary).toContain("• Key Achievements:");
    expect(submitted.aiSummary).toContain("• Sentiment Analysis:");
    expect(submitted.aiSummary).toContain("• Flagged Risks:");
  }, 15000);

  // =========================================================================
  // TEST 6: Tenant Policy Toggle (Auto-Approval Disabled at Template Level)
  // =========================================================================
  it("6. should respect template autoApprovalEnabled: false policy and block autonomous approvals", async () => {
    // Enterprise tenant opts out of auto-approval for executive/sensitive role template
    const template = await milestoneService.createTemplate(testOrg._id, adminUser._id, {
      title: "Executive VP Day 90 Governance Review",
      targetDay: 90,
      autoApprovalEnabled: false, // Strict human review policy
    });

    const milestone = await milestoneService.assignMilestone(
      testOrg._id,
      template._id,
      employeeUser._id,
      adminUser._id
    );

    // Even with a perfect rating of 5, auto-approval is blocked by tenant policy
    const submitted = await milestoneService.submitEmployeeSelfCheck(
      testOrg._id,
      milestone._id,
      employeeUser._id,
      {
        employeeRating: 5,
        comments: "Flawless onboarding across all governance checkpoints.",
      }
    );

    expect(submitted.sla?.autoApprovalEligible).toBe(false);

    // Advance past SLA
    submitted.submittedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    if (submitted.sla) {
      submitted.sla.reviewDeadline = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    }
    await submitted.save();

    await milestoneService.scanPendingMilestoneReviews(testOrg._id);

    const reloaded = await EmployeeMilestone.findById(milestone._id);
    expect(reloaded?.status).toBe("pending_manager_review"); // Blocked by policy!
    expect(reloaded?.sla?.escalationState).toBe("escalated");
  }, 15000);
});
