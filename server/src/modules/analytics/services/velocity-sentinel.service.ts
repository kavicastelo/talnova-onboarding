import mongoose from "mongoose";
import User, { IUser } from "../../auth/models/user.model.js";
import { EmployeeAssignment } from "../../assignments/models/assignment.model.js";
import { Task } from "../../tasks/models/task.model.js";
import { DocumentAssignment } from "../../documents/models/document-assignment.model.js";
import { BuddyAssignment } from "../../buddy/models/buddy-assignment.model.js";
import { CalendarService } from "../../calendar/services/calendar.service.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import { OnboardingHealth, IOnboardingHealth } from "../models/onboarding-health.model.js";
import { OnboardingCase } from "../../onboarding/models/onboarding-case.model.js";
import { eventBus } from "../../../infrastructure/events/event-bus.js";

export interface IEvaluationOptions {
  ignoreTimezone?: boolean;
  now?: Date;
  forceNudge?: boolean;
}

export interface IEvaluationResult {
  health: IOnboardingHealth;
  nudged: boolean;
  level?: number;
  reason?: string;
  action?: string;
}

export class VelocitySentinelService {
  private calendarService: CalendarService;
  private notificationService: NotificationService;

  constructor(calendarService?: CalendarService, notificationService?: NotificationService) {
    this.calendarService = calendarService || new CalendarService();
    this.notificationService =
      notificationService || new NotificationService(new NotificationRepository());
  }

  /**
   * Evaluates an individual employee's onboarding velocity, drop-off risk, and executes omnichannel nudges if stalled.
   */
  async evaluateEmployeeHealth(
    userId: string | mongoose.Types.ObjectId,
    orgId?: string | mongoose.Types.ObjectId,
    options?: IEvaluationOptions
  ): Promise<IEvaluationResult | null> {
    const user = await User.findById(userId);
    if (!user || user.isDeleted) {
      return null;
    }

    const organizationId = user.organizationId;
    const now = options?.now || new Date();

    // 1. Ingest telemetry from Assignments, Tasks, and Documents
    const [assignments, tasks, documents] = await Promise.all([
      EmployeeAssignment.find({
        employeeId: user._id,
        organizationId,
        isDeleted: { $ne: true },
      }),
      Task.find({
        $or: [{ employeeId: user._id }, { assignedToUserId: user._id }],
        organizationId,
        isDeleted: false,
      }),
      DocumentAssignment.find({
        employeeId: user._id,
        organizationId,
        isDeleted: false,
      }),
    ]);

    // Item Metrics
    const totalLessons = assignments.reduce(
      (sum, a) => sum + (a.progress?.totalLessons || 0),
      0
    );
    const completedLessons = assignments.reduce(
      (sum, a) => sum + (a.progress?.completedLessons || 0),
      0
    );

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(
      (t) => t.status === "completed" || t.status === "verified"
    ).length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueDate &&
        new Date(t.dueDate) < now &&
        t.status !== "completed" &&
        t.status !== "verified"
    ).length;

    const totalDocs = documents.length;
    const completedDocs = documents.filter((d) => d.status === "signed").length;
    const overdueDocs = documents.filter(
      (d) => d.dueDate && new Date(d.dueDate) < now && d.status !== "signed"
    ).length;

    const overdueAssignments = assignments.filter(
      (a) =>
        a.assignment?.dueDate &&
        new Date(a.assignment.dueDate) < now &&
        a.status !== "completed"
    ).length;

    const totalItems = totalLessons + totalTasks + totalDocs;
    const completedItems = completedLessons + completedTasks + completedDocs;
    const overdueItems = overdueTasks + overdueDocs + overdueAssignments;

    // Last Activity Determination
    const activityDates: Date[] = [];
    assignments.forEach((a) => {
      if (a.progress?.lastActivityAt) activityDates.push(new Date(a.progress.lastActivityAt));
      if (a.updatedAt) activityDates.push(new Date(a.updatedAt));
    });
    tasks.forEach((t) => {
      if (t.completedAt) activityDates.push(new Date(t.completedAt));
      if (t.status === "completed" || t.status === "verified") {
        activityDates.push(new Date(t.updatedAt));
      }
    });
    documents.forEach((d) => {
      if (d.signedAt) activityDates.push(new Date(d.signedAt));
      if (d.status === "signed" || d.status === "viewed") {
        activityDates.push(new Date(d.updatedAt));
      }
    });

    let lastActiveAt: Date;
    if (activityDates.length > 0) {
      lastActiveAt = new Date(Math.max(...activityDates.map((d) => d.getTime())));
    } else if (user.employment?.hireDate) {
      lastActiveAt = new Date(user.employment.hireDate);
    } else {
      lastActiveAt = new Date(user.createdAt || now);
    }

    const daysInactive = Math.max(
      0,
      Math.floor((now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Velocity & Expected Velocity Calculation
    const startDate = user.employment?.hireDate || user.createdAt || now;
    const elapsedDays = Math.max(
      1,
      Math.floor((now.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const targetDurationDays = 30; // standard onboarding benchmark target

    const velocity = Math.round((completedItems / elapsedDays) * 100) / 100;
    const expectedVelocity = Math.round((totalItems / targetDurationDays) * 100) / 100;

    // Dynamic Drop-off Risk Scoring (0.0 to 1.0)
    let dropOffRiskScore = 0.0;
    if (totalItems === 0) {
      dropOffRiskScore = 0.0;
    } else if (daysInactive >= 5 || overdueItems > 0) {
      dropOffRiskScore = 0.9;
    } else if (daysInactive >= 3 && velocity < 0.5 * Math.max(expectedVelocity, 0.01)) {
      dropOffRiskScore = 0.7;
    } else if (expectedVelocity > 0 && velocity >= expectedVelocity) {
      dropOffRiskScore = 0.0;
    } else {
      dropOffRiskScore = 0.3;
    }

    const riskLevel: "on_track" | "at_risk" | "critical" =
      dropOffRiskScore >= 0.85
        ? "critical"
        : dropOffRiskScore >= 0.65
        ? "at_risk"
        : "on_track";

    // Upsert OnboardingHealth document
    let health = await OnboardingHealth.findOne({
      organizationId,
      employeeId: user._id,
    });

    if (!health) {
      health = new OnboardingHealth({
        organizationId,
        employeeId: user._id,
      });
    }

    health.velocity = velocity;
    health.expectedVelocity = expectedVelocity;
    health.dropOffRiskScore = dropOffRiskScore;
    health.riskLevel = riskLevel;
    health.completedItemsCount = completedItems;
    health.totalItemsCount = totalItems;
    health.daysInactive = daysInactive;
    health.itemsOverdue = overdueItems;
    health.lastActiveAt = lastActiveAt;
    health.calculatedAt = now;

    // 2. Leave Suppression Guard
    const empStatus = user.employment?.status;
    if (empStatus === "on_leave" || empStatus === "sick") {
      health.suppressedReason = `Suppressed: Employee is on leave (${empStatus})`;
      await health.save();
      return { health, nudged: false, reason: health.suppressedReason };
    }

    if (user.employment?.onboardingState === "paused") {
      health.suppressedReason = "Suppressed: Onboarding is paused";
      await health.save();
      return { health, nudged: false, reason: health.suppressedReason };
    }

    // 3. Determine Desired Escalation Level
    let desiredLevel = 0;
    if (daysInactive >= 14) {
      desiredLevel = 4;
    } else if (daysInactive >= 7 || overdueItems > 0) {
      desiredLevel = 3;
    } else if (daysInactive >= 5) {
      desiredLevel = 2;
    } else if (daysInactive >= 3) {
      desiredLevel = 1;
    }

    if (desiredLevel === 0) {
      health.suppressedReason = undefined;
      await health.save();
      return { health, nudged: false, reason: "On track, no intervention required" };
    }

    // 4. Cooldown Throttling (48h cooldown window)
    // Exception: If a critical item is due within 24 hours, bypass cooldown.
    const hasUrgentDueItem =
      tasks.some(
        (t) =>
          t.dueDate &&
          new Date(t.dueDate) > now &&
          new Date(t.dueDate).getTime() - now.getTime() <= 24 * 60 * 60 * 1000 &&
          t.status !== "completed" &&
          t.status !== "verified"
      ) ||
      documents.some(
        (d) =>
          d.dueDate &&
          new Date(d.dueDate) > now &&
          new Date(d.dueDate).getTime() - now.getTime() <= 24 * 60 * 60 * 1000 &&
          d.status !== "signed"
      ) ||
      assignments.some(
        (a) =>
          a.assignment?.dueDate &&
          new Date(a.assignment.dueDate) > now &&
          new Date(a.assignment.dueDate).getTime() - now.getTime() <= 24 * 60 * 60 * 1000 &&
          a.status !== "completed"
      );

    if (
      !options?.forceNudge &&
      health.lastNudgedAt &&
      now.getTime() - new Date(health.lastNudgedAt).getTime() < 48 * 60 * 60 * 1000 &&
      !hasUrgentDueItem
    ) {
      health.suppressedReason = `Suppressed: Throttled by 48h cooldown window (last nudged ${health.lastNudgedAt.toISOString()})`;
      await health.save();
      return { health, nudged: false, reason: health.suppressedReason };
    }

    // 5. Business Hours / Timezone Compliance (09:00 - 17:00 local time)
    if (!options?.ignoreTimezone) {
      const tz = user.profile?.timezone || "UTC";
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hour: "numeric",
          hour12: false,
        });
        const hour = parseInt(formatter.format(now), 10);
        if (hour < 9 || hour >= 17) {
          health.suppressedReason = `Deferred: Current local time (${hour}:00) in timezone ${tz} is outside business hours (09:00 - 17:00)`;
          await health.save();
          return { health, nudged: false, reason: health.suppressedReason };
        }
      } catch (err) {
        // Fallback gracefully if timezone is invalid string
      }
    }

    // 6. Execute Omnichannel Escalation Pipeline
    let actionSummary = "";

    if (desiredLevel === 1) {
      // Level 1: In-app toast + polite email
      await this.notificationService.createNotification({
        organizationId,
        recipientUserId: user._id,
        type: "journey_due_soon",
        channel: "in_app",
        title: "Keep up your momentum!",
        message: `Hi ${user.profile.fullName}, you have ${totalItems - completedItems} onboarding tasks awaiting your attention. Take a few minutes to make progress today!`,
        priority: "medium",
      });
      await this.notificationService.createNotification({
        organizationId,
        recipientUserId: user._id,
        type: "journey_due_soon",
        channel: "email",
        title: "Onboarding Check-In",
        message: `Hi ${user.profile.fullName}, we noticed you haven't been active recently. Jump back in to finish your setup!`,
        priority: "medium",
      });
      actionSummary = "Level 1: Sent in-app toast and email check-in";
    } else if (desiredLevel === 2) {
      // Level 2: High priority email + Buddy Alert
      await this.notificationService.createNotification({
        organizationId,
        recipientUserId: user._id,
        type: "journey_due_soon",
        channel: "email",
        title: "High Priority: Important Onboarding Steps Pending",
        message: `Hi ${user.profile.fullName}, you have important onboarding items that require attention. Please review your dashboard.`,
        priority: "high",
      });

      const buddyAssignment = await BuddyAssignment.findOne({
        newHireUserId: user._id,
        organizationId,
        status: "active",
        isDeleted: false,
      });

      if (buddyAssignment && buddyAssignment.buddyUserId) {
        await this.notificationService.createNotification({
          organizationId,
          recipientUserId: buddyAssignment.buddyUserId,
          type: "manager_alert",
          title: `Buddy Alert: Check in with ${user.profile.fullName}`,
          message: `${user.profile.fullName} has been inactive for ${daysInactive} days in onboarding. Please reach out to offer assistance or schedule a coffee chat!`,
          priority: "high",
        });
        actionSummary = `Level 2: High priority email sent + Buddy alert dispatched to buddy (${buddyAssignment.buddyUserId})`;
      } else {
        actionSummary = "Level 2: High priority email sent (no active buddy assigned)";
      }
    } else if (desiredLevel === 3) {
      // Level 3: Manager Alert + Auto-Schedule 15-min Sync
      const managerId = user.employment?.managerId;
      if (managerId) {
        await this.notificationService.createNotification({
          organizationId,
          recipientUserId: managerId,
          type: "manager_alert",
          title: `Urgent Manager Alert: ${user.profile.fullName} is stalled`,
          message: `${user.profile.fullName} is stalled in onboarding (risk: ${dropOffRiskScore}, inactive: ${daysInactive} days, overdue: ${overdueItems}). A 15-minute 1:1 sync has been auto-scheduled.`,
          priority: "critical",
        });

        // Auto-schedule 15-min 1:1 check-in
        const syncStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        syncStart.setHours(10, 0, 0, 0);
        const syncEnd = new Date(syncStart.getTime() + 15 * 60 * 1000);

        try {
          await this.calendarService.createMeetingEvent(organizationId, managerId, {
            title: `1:1 Onboarding Sync: ${user.profile.fullName}`,
            description: `Automated 15-minute sync scheduled by Talnova Velocity Sentinel to assist ${user.profile.fullName} with stalled onboarding progress.`,
            category: "manager_1on1",
            attendeeUserIds: [user._id.toString(), managerId.toString()],
            startTime: syncStart,
            endTime: syncEnd,
            timezone: user.profile?.timezone || "UTC",
          });
          actionSummary = `Level 3: Critical alert sent to manager + 15-min 1:1 sync auto-scheduled`;
        } catch (calErr: any) {
          actionSummary = `Level 3: Critical alert sent to manager (calendar sync error: ${calErr?.message || "failed"})`;
        }
      } else {
        actionSummary = `Level 3: Critical drop-off risk detected, no manager assigned`;
      }
    } else if (desiredLevel === 4) {
      // Level 4: HR Ops Exception Workbench Escalation
      const hrAdmins = await User.find({
        organizationId,
        "permissions.role": { $in: ["admin", "owner"] },
        isDeleted: false,
      });

      for (const admin of hrAdmins) {
        await this.notificationService.createNotification({
          organizationId,
          recipientUserId: admin._id,
          type: "manager_alert",
          title: `HR Ops Escalation: ${user.profile.fullName} critically stalled`,
          message: `Employee ${user.profile.fullName} has been stalled for ${daysInactive} days (risk score: ${dropOffRiskScore}). Handed over to HR Exception Workbench for intervention.`,
          priority: "critical",
        });
      }

      // Annotate OnboardingCase if present
      await OnboardingCase.updateOne(
        { employeeId: user._id, organizationId },
        {
          $set: {
            stateReason: `Escalated to HR Ops by Velocity Sentinel: Inactivity of ${daysInactive} days`,
          },
        }
      );

      actionSummary = `Level 4: Escalated to HR Ops exception workbench (${hrAdmins.length} admins notified)`;
    }

    // Publish event
    await eventBus.publish("ONBOARDING_NUDGE_SENT", {
      organizationId: organizationId.toString(),
      payload: {
        employeeId: user._id.toString(),
        nudgeLevel: desiredLevel,
        riskScore: dropOffRiskScore,
        riskLevel,
        daysInactive,
        actionTaken: actionSummary,
      },
    });

    health.nudgeLevel = desiredLevel;
    health.lastNudgedAt = now;
    health.lastNudgeMessage = actionSummary;
    health.suppressedReason = undefined;
    await health.save();

    return {
      health,
      nudged: true,
      level: desiredLevel,
      action: actionSummary,
    };
  }

  /**
   * Scans all onboarding employees in an organization, recalculates health, and triggers appropriate nudges.
   */
  async scanOrganizationHealth(
    orgId: string | mongoose.Types.ObjectId,
    options?: IEvaluationOptions
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());
    const candidates = await User.find({
      organizationId: orgObjectId,
      "employment.status": { $in: ["onboarding", "active"] },
      isDeleted: false,
    });

    const results: IEvaluationResult[] = [];
    let nudgedCount = 0;
    let criticalCount = 0;
    let suppressedCount = 0;

    for (const candidate of candidates) {
      const res = await this.evaluateEmployeeHealth(candidate._id, orgObjectId, options);
      if (res) {
        results.push(res);
        if (res.nudged) nudgedCount++;
        if (res.health.riskLevel === "critical") criticalCount++;
        if (res.health.suppressedReason) suppressedCount++;
      }
    }

    return {
      organizationId: orgId.toString(),
      totalEvaluated: candidates.length,
      nudgedCount,
      criticalCount,
      suppressedCount,
      results,
    };
  }

  /**
   * Scans all organizations for onboarding health.
   */
  async scanAllOrganizations(options?: IEvaluationOptions) {
    const orgIds = await User.distinct("organizationId", { isDeleted: false });
    const summaries = [];

    for (const orgId of orgIds) {
      if (orgId) {
        const summary = await this.scanOrganizationHealth(orgId, options);
        summaries.push(summary);
      }
    }

    return summaries;
  }
}

export default VelocitySentinelService;
