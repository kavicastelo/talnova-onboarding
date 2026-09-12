import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import EmployeeAssignment from "../modules/assignments/models/assignment.model.js";
import Task from "../modules/tasks/models/task.model.js";
import DocumentAssignment from "../modules/documents/models/document-assignment.model.js";
import BuddyAssignment from "../modules/buddy/models/buddy-assignment.model.js";
import MeetingEvent from "../modules/calendar/models/meeting-event.model.js";
import OnboardingHealth from "../modules/analytics/models/onboarding-health.model.js";
import OnboardingCase from "../modules/onboarding/models/onboarding-case.model.js";
import Notification from "../modules/notifications/models/notification.model.js";
import { VelocitySentinelService } from "../modules/analytics/services/velocity-sentinel.service.js";
import queueService from "../infrastructure/queue/queue.service.js";
import registerEventSubscribers from "../infrastructure/events/event-subscribers.js";

describe("Phase 3 — Autonomous Monitoring, Velocity Scoring & Omnichannel Alerts (Velocity Sentinel)", () => {
  let app: FastifyInstance;
  let orgId: mongoose.Types.ObjectId;
  let adminId: mongoose.Types.ObjectId;
  let managerId: mongoose.Types.ObjectId;
  let buddyId: mongoose.Types.ObjectId;
  let sentinel: VelocitySentinelService;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();
    registerEventSubscribers();
    sentinel = new VelocitySentinelService();

    orgId = new mongoose.Types.ObjectId();
    adminId = new mongoose.Types.ObjectId();
    managerId = new mongoose.Types.ObjectId();
    buddyId = new mongoose.Types.ObjectId();

    await Organization.create({
      _id: orgId,
      name: "Sentinel Enterprises",
      slug: `sentinel-corp-${Date.now()}`,
      active: true,
      createdBy: adminId,
    });

    await User.create([
      {
        _id: adminId,
        organizationId: orgId,
        auth: { email: `admin-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
        profile: { firstName: "Admin", lastName: "HR", fullName: "Admin HR", timezone: "UTC" },
        permissions: { role: "admin", customRoles: [] },
        employment: { status: "active", employmentType: "full_time" },
      },
      {
        _id: managerId,
        organizationId: orgId,
        auth: { email: `manager-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
        profile: { firstName: "Engineering", lastName: "Manager", fullName: "Engineering Manager", timezone: "UTC" },
        permissions: { role: "manager", customRoles: [] },
        employment: { status: "active", employmentType: "full_time" },
      },
      {
        _id: buddyId,
        organizationId: orgId,
        auth: { email: `buddy-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
        profile: { firstName: "Senior", lastName: "Buddy", fullName: "Senior Buddy", timezone: "UTC" },
        permissions: { role: "employee", customRoles: [] },
        employment: { status: "active", employmentType: "full_time" },
      },
    ]);
  });

  beforeEach(async () => {
    await OnboardingHealth.deleteMany({ organizationId: orgId });
    await EmployeeAssignment.deleteMany({ organizationId: orgId });
    await Task.deleteMany({ organizationId: orgId });
    await DocumentAssignment.deleteMany({ organizationId: orgId });
    await BuddyAssignment.deleteMany({ organizationId: orgId });
    await MeetingEvent.deleteMany({ organizationId: orgId });
    await Notification.deleteMany({ organizationId: orgId });
    await OnboardingCase.deleteMany({ organizationId: orgId });
  });

  afterAll(async () => {
    await OnboardingHealth.deleteMany({ organizationId: orgId });
    await User.deleteMany({ organizationId: orgId });
    await Organization.deleteOne({ _id: orgId });
    await disconnectDatabase(app.log);
    await app.close();
  });

  it("1. Accurately calculates velocity, expected velocity, and drop-off risk score for stalled employees", async () => {
    const employeeId = new mongoose.Types.ObjectId();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    const employee = await User.create({
      _id: employeeId,
      organizationId: orgId,
      auth: { email: `hire-stalled-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Stalled", lastName: "Hire", fullName: "Stalled Hire", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: {
        status: "onboarding",
        hireDate: fourDaysAgo,
        managerId,
        employmentType: "full_time",
      },
      createdAt: fourDaysAgo,
    });

    // Create 10 total items: 5 lessons in an assignment, 3 tasks, 2 documents
    await EmployeeAssignment.create({
      organizationId: orgId,
      employeeId,
      assignedBy: adminId,
      journey: { journeyId: new mongoose.Types.ObjectId(), title: "Eng Onboarding", version: 1 },
      assignment: { assignedAt: fourDaysAgo, priority: "normal" },
      status: "assigned",
      progress: {
        totalModules: 1,
        completedModules: 0,
        totalLessons: 5,
        completedLessons: 0,
        completionPercentage: 0,
        totalTimeSpentSeconds: 0,
      },
      createdAt: fourDaysAgo,
      updatedAt: fourDaysAgo,
    });

    for (let i = 0; i < 3; i++) {
      await Task.create({
        organizationId: orgId,
        employeeId,
        assignedToUserId: employeeId,
        createdBy: adminId,
        title: `Task #${i + 1}`,
        status: "pending",
        stage: "day_1",
        priority: "normal",
        createdAt: fourDaysAgo,
        updatedAt: fourDaysAgo,
      });
    }

    for (let i = 0; i < 2; i++) {
      await DocumentAssignment.create({
        organizationId: orgId,
        templateId: new mongoose.Types.ObjectId(),
        templateTitle: `Doc #${i + 1}`,
        templateVersion: 1,
        employeeId,
        assignedBy: adminId,
        status: "pending",
        assignedAt: fourDaysAgo,
        auditTrail: [],
        createdAt: fourDaysAgo,
        updatedAt: fourDaysAgo,
      });
    }

    // Evaluate health
    const result = await sentinel.evaluateEmployeeHealth(employeeId, orgId, {
      ignoreTimezone: true,
    });

    expect(result).not.toBeNull();
    expect(result!.health.totalItemsCount).toBe(10);
    expect(result!.health.completedItemsCount).toBe(0);
    expect(result!.health.velocity).toBe(0);
    expect(result!.health.expectedVelocity).toBeGreaterThan(0);
    expect(result!.health.daysInactive).toBeGreaterThanOrEqual(4);
    expect(result!.health.dropOffRiskScore).toBeGreaterThanOrEqual(0.7);
    expect(["at_risk", "critical"]).toContain(result!.health.riskLevel);

    // Verify DB persistence & indexing
    const savedHealth = await OnboardingHealth.findOne({ organizationId: orgId, employeeId });
    expect(savedHealth).not.toBeNull();
    expect(savedHealth!.dropOffRiskScore).toBe(result!.health.dropOffRiskScore);
  });

  it("2. Orchestrates escalating 4-level omnichannel intervention pipeline", async () => {
    // Level 1: 3 days inactive -> In-app & email nudge
    const emp1Id = new mongoose.Types.ObjectId();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await User.create({
      _id: emp1Id,
      organizationId: orgId,
      auth: { email: `level1-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Level", lastName: "One", fullName: "Level One", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: threeDaysAgo, employmentType: "full_time" },
      createdAt: threeDaysAgo,
    });
    await Task.create({
      organizationId: orgId,
      employeeId: emp1Id,
      assignedToUserId: emp1Id,
      createdBy: adminId,
      title: "Basic Setup",
      status: "pending",
      stage: "day_1",
      createdAt: threeDaysAgo,
    });

    const res1 = await sentinel.evaluateEmployeeHealth(emp1Id, orgId, { ignoreTimezone: true });
    expect(res1?.nudged).toBe(true);
    expect(res1?.level).toBe(1);
    const notifications1 = await Notification.find({ recipientUserId: emp1Id });
    expect(notifications1.length).toBeGreaterThanOrEqual(1);

    // Level 2: 5 days inactive -> Buddy Alert
    const emp2Id = new mongoose.Types.ObjectId();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    await User.create({
      _id: emp2Id,
      organizationId: orgId,
      auth: { email: `level2-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Level", lastName: "Two", fullName: "Level Two", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: fiveDaysAgo, employmentType: "full_time" },
      createdAt: fiveDaysAgo,
    });
    await Task.create({
      organizationId: orgId,
      employeeId: emp2Id,
      assignedToUserId: emp2Id,
      createdBy: adminId,
      title: "Task Day 5",
      status: "pending",
      stage: "day_1",
      createdAt: fiveDaysAgo,
    });
    await BuddyAssignment.create({
      organizationId: orgId,
      newHireUserId: emp2Id,
      buddyUserId: buddyId,
      assignedBy: adminId,
      assignedAt: fiveDaysAgo,
      status: "active",
      checklist: [],
      checkins: [],
      isDeleted: false,
    });

    const res2 = await sentinel.evaluateEmployeeHealth(emp2Id, orgId, { ignoreTimezone: true });
    expect(res2?.nudged).toBe(true);
    expect(res2?.level).toBe(2);
    const buddyNotifs = await Notification.find({ recipientUserId: buddyId });
    expect(buddyNotifs.length).toBeGreaterThanOrEqual(1);
    expect(buddyNotifs[0].title).toContain("Buddy Alert");

    // Level 3: 7 days inactive -> Manager Alert + Auto-Schedule 15-min 1:1 Meeting
    const emp3Id = new mongoose.Types.ObjectId();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    await User.create({
      _id: emp3Id,
      organizationId: orgId,
      auth: { email: `level3-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Level", lastName: "Three", fullName: "Level Three", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: sevenDaysAgo, managerId, employmentType: "full_time" },
      createdAt: sevenDaysAgo,
    });
    await Task.create({
      organizationId: orgId,
      employeeId: emp3Id,
      assignedToUserId: emp3Id,
      createdBy: adminId,
      title: "Stalled Critical Task",
      status: "pending",
      stage: "day_1",
      createdAt: sevenDaysAgo,
    });

    const res3 = await sentinel.evaluateEmployeeHealth(emp3Id, orgId, { ignoreTimezone: true });
    expect(res3?.nudged).toBe(true);
    expect(res3?.level).toBe(3);

    // Verify Manager alert
    const mgrNotifs = await Notification.find({ recipientUserId: managerId });
    expect(mgrNotifs.length).toBeGreaterThanOrEqual(1);
    expect(mgrNotifs[0].title).toContain("Manager Alert");

    // Verify Calendar 1:1 auto-scheduled
    const scheduledMeetings = await MeetingEvent.find({
      organizationId: orgId,
      category: "manager_1on1",
    });
    expect(scheduledMeetings.length).toBeGreaterThanOrEqual(1);
    const meeting = scheduledMeetings.find((m) =>
      m.attendeeUserIds.map((id) => id.toString()).includes(emp3Id.toString())
    );
    expect(meeting).toBeDefined();
    expect(meeting!.title).toContain("1:1 Onboarding Sync: Level Three");

    // Level 4: 14 days inactive -> HR Ops Exception Workbench Escalation
    const emp4Id = new mongoose.Types.ObjectId();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    await User.create({
      _id: emp4Id,
      organizationId: orgId,
      auth: { email: `level4-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Level", lastName: "Four", fullName: "Level Four", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: fourteenDaysAgo, employmentType: "full_time" },
      createdAt: fourteenDaysAgo,
    });
    await Task.create({
      organizationId: orgId,
      employeeId: emp4Id,
      assignedToUserId: emp4Id,
      createdBy: adminId,
      title: "Forgotten Task",
      status: "pending",
      stage: "day_1",
      createdAt: fourteenDaysAgo,
    });
    await OnboardingCase.create({
      organizationId: orgId,
      employeeId: emp4Id,
      source: "manual",
      idempotencyKey: `case-${emp4Id}`,
      state: "active",
      transitions: [],
      isDeleted: false,
    });

    const res4 = await sentinel.evaluateEmployeeHealth(emp4Id, orgId, { ignoreTimezone: true });
    expect(res4?.nudged).toBe(true);
    expect(res4?.level).toBe(4);

    // Verify HR Admin alert
    const adminNotifs = await Notification.find({ recipientUserId: adminId });
    expect(adminNotifs.some((n) => n.title.includes("HR Ops Escalation"))).toBe(true);

    // Verify OnboardingCase stateReason annotation
    const updatedCase = await OnboardingCase.findOne({ employeeId: emp4Id, organizationId: orgId });
    expect(updatedCase?.stateReason).toContain("Escalated to HR Ops");
  });

  it("3. Enforces 48h cooldown throttling unless critical item is due within 24h", async () => {
    const empId = new mongoose.Types.ObjectId();
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);

    await User.create({
      _id: empId,
      organizationId: orgId,
      auth: { email: `throttle-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Throttle", lastName: "Test", fullName: "Throttle Test", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: fourDaysAgo, employmentType: "full_time" },
      createdAt: fourDaysAgo,
    });

    const task = await Task.create({
      organizationId: orgId,
      employeeId: empId,
      assignedToUserId: empId,
      createdBy: adminId,
      title: "Cool Task",
      status: "pending",
      stage: "day_1",
      createdAt: fourDaysAgo,
    });

    // 1st scan: triggers nudge
    const firstScan = await sentinel.evaluateEmployeeHealth(empId, orgId, { ignoreTimezone: true });
    expect(firstScan?.nudged).toBe(true);

    // 2nd scan: immediate subsequent scan should be throttled by 48h cooldown
    const secondScan = await sentinel.evaluateEmployeeHealth(empId, orgId, { ignoreTimezone: true });
    expect(secondScan?.nudged).toBe(false);
    expect(secondScan?.reason).toContain("Throttled by 48h cooldown window");

    // Add an urgent deadline (due in 12 hours) -> bypasses cooldown window
    task.dueDate = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await task.save();

    const urgentScan = await sentinel.evaluateEmployeeHealth(empId, orgId, { ignoreTimezone: true });
    expect(urgentScan?.nudged).toBe(true);
  });

  it("4. Complies with local timezone business hours (09:00 - 17:00)", async () => {
    const empTokyoId = new mongoose.Types.ObjectId();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    await User.create({
      _id: empTokyoId,
      organizationId: orgId,
      auth: { email: `tokyo-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Tokyo", lastName: "Hire", fullName: "Tokyo Hire", timezone: "Asia/Tokyo" },
      permissions: { role: "employee", customRoles: [] },
      employment: { status: "onboarding", hireDate: fiveDaysAgo, employmentType: "full_time" },
      createdAt: fiveDaysAgo,
    });
    await Task.create({
      organizationId: orgId,
      employeeId: empTokyoId,
      assignedToUserId: empTokyoId,
      createdBy: adminId,
      title: "Tokyo Task",
      status: "pending",
      stage: "day_1",
      createdAt: fiveDaysAgo,
    });

    // Tokyo is UTC+9.
    // When UTC is 14:00, Tokyo time is 23:00 (outside 09:00 - 17:00).
    const eveningUtc = new Date("2026-09-13T14:00:00Z");
    const deferredScan = await sentinel.evaluateEmployeeHealth(empTokyoId, orgId, {
      now: eveningUtc,
      ignoreTimezone: false,
    });
    expect(deferredScan?.nudged).toBe(false);
    expect(deferredScan?.reason).toContain("outside business hours");

    // When UTC is 02:00, Tokyo time is 11:00 (inside 09:00 - 17:00 business hours).
    const morningUtc = new Date("2026-09-13T02:00:00Z");
    const allowedScan = await sentinel.evaluateEmployeeHealth(empTokyoId, orgId, {
      now: morningUtc,
      ignoreTimezone: false,
    });
    expect(allowedScan?.nudged).toBe(true);
  });

  it("5. Suppresses nudges when employee is on leave, sick, or onboarding is paused", async () => {
    const empLeaveId = new mongoose.Types.ObjectId();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);

    const empLeave = await User.create({
      _id: empLeaveId,
      organizationId: orgId,
      auth: { email: `leave-${Date.now()}@sentinel.corp`, passwordHash: "dummy" },
      profile: { firstName: "Leave", lastName: "Hire", fullName: "Leave Hire", timezone: "UTC" },
      permissions: { role: "employee", customRoles: [] },
      employment: {
        status: "on_leave",
        hireDate: tenDaysAgo,
        employmentType: "full_time",
      },
      createdAt: tenDaysAgo,
    });

    await Task.create({
      organizationId: orgId,
      employeeId: empLeaveId,
      assignedToUserId: empLeaveId,
      createdBy: adminId,
      title: "Leave Task",
      status: "pending",
      stage: "day_1",
      createdAt: tenDaysAgo,
    });

    // on_leave check
    const resLeave = await sentinel.evaluateEmployeeHealth(empLeaveId, orgId, { ignoreTimezone: true });
    expect(resLeave?.nudged).toBe(false);
    expect(resLeave?.reason).toContain("Suppressed: Employee is on leave (on_leave)");

    // sick check
    empLeave.employment.status = "sick";
    await empLeave.save();
    const resSick = await sentinel.evaluateEmployeeHealth(empLeaveId, orgId, { ignoreTimezone: true });
    expect(resSick?.nudged).toBe(false);
    expect(resSick?.reason).toContain("Suppressed: Employee is on leave (sick)");

    // paused onboarding check
    empLeave.employment.status = "onboarding";
    empLeave.employment.onboardingState = "paused";
    await empLeave.save();
    const resPaused = await sentinel.evaluateEmployeeHealth(empLeaveId, orgId, { ignoreTimezone: true });
    expect(resPaused?.nudged).toBe(false);
    expect(resPaused?.reason).toContain("Suppressed: Onboarding is paused");
  });

  it("6. Scans organization batch health and integrates with asynchronous background workers", async () => {
    const batchSummary = await sentinel.scanOrganizationHealth(orgId, { ignoreTimezone: true });
    expect(batchSummary).toBeDefined();
    expect(batchSummary.totalEvaluated).toBeGreaterThanOrEqual(1);

    // Queue worker execution test
    let workerTriggered = false;
    let receivedPayload: any = null;
    queueService.registerWorker("test_sentinel_worker", async (job) => {
      receivedPayload = job.data;
      workerTriggered = true;
    });

    await queueService.enqueue("test_sentinel_worker", { organizationId: orgId.toString(), task: "health_evaluation" }, {
      organizationId: orgId.toString(),
    });

    // Wait for asynchronous job execution in queue worker
    let attempts = 0;
    while (!workerTriggered && attempts++ < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(workerTriggered).toBe(true);
    expect(receivedPayload?.organizationId).toBe(orgId.toString());
  });
});
