import mongoose from "mongoose";
import User from "../../auth/models/user.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";
import DocumentAssignment from "../../documents/models/document-assignment.model.js";
import EmployeeMilestone from "../../milestones/models/employee-milestone.model.js";
import BuddyAssignment from "../../buddy/models/buddy-assignment.model.js";
import Task from "../../tasks/models/task.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export class HROperationsService {
  /**
   * Get Unified HR Operational Dashboard Metrics (HR-001)
   */
  async getDashboardMetrics(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    const [
      totalEmployees,
      activeOnboardees,
      pausedOnboardees,
      journeyAssignments,
      pendingDocuments,
      overdueMilestones,
      unassignedBuddiesCount,
    ] = await Promise.all([
      User.countDocuments({ organizationId: orgObjectId, isDeleted: false }),
      User.countDocuments({
        organizationId: orgObjectId,
        "permissions.role": "employee",
        "employment.onboardingState": { $in: ["active", undefined] },
        isDeleted: false,
      }),
      User.countDocuments({
        organizationId: orgObjectId,
        "employment.onboardingState": "paused",
        isDeleted: false,
      }),
      EmployeeAssignment.find({ organizationId: orgObjectId, isDeleted: false }).select("status progress"),
      DocumentAssignment.countDocuments({
        organizationId: orgObjectId,
        status: { $in: ["assigned", "sent", "viewed"] },
        isDeleted: false,
      }),
      EmployeeMilestone.countDocuments({
        organizationId: orgObjectId,
        status: "overdue",
        isDeleted: false,
      }),
      (async () => {
        const employees = await User.find({
          organizationId: orgObjectId,
          "permissions.role": "employee",
          isDeleted: false,
        }).select("_id");
        const assignedBuddyUserIds = await BuddyAssignment.distinct("menteeUserId", {
          organizationId: orgObjectId,
          status: "active",
        });
        const assignedSet = new Set(assignedBuddyUserIds.map((id: any) => id.toString()));
        return employees.filter((e) => !assignedSet.has(e._id.toString())).length;
      })(),
    ]);

    const completedAssignmentsCount = journeyAssignments.filter((a) => a.status === "completed").length;
    const journeyComplianceRate = journeyAssignments.length
      ? Math.round((completedAssignmentsCount / journeyAssignments.length) * 100)
      : 100;

    return {
      totalEmployees,
      activeOnboardees,
      pausedOnboardees,
      journeyComplianceRate,
      pendingDocuments,
      overdueMilestones,
      unassignedBuddiesCount,
    };
  }

  /**
   * Get Onboarding Exception & Risk Escalation Queue (HR-004)
   */
  async getExceptionQueue(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    const activeEmployees = await User.find({
      organizationId: orgObjectId,
      "permissions.role": "employee",
      isDeleted: false,
    }).select("_id profile auth employment createdAt");

    const employeeIds = activeEmployees.map((e) => e._id);

    const [overdueAssignments, pendingDocs, overdueTasks, buddyAssignments] = await Promise.all([
      EmployeeAssignment.find({
        organizationId: orgObjectId,
        employeeId: { $in: employeeIds },
        status: "overdue",
        isDeleted: false,
      }).populate("journey.journeyId", "title"),
      DocumentAssignment.find({
        organizationId: orgObjectId,
        recipientUserId: { $in: employeeIds },
        status: { $in: ["assigned", "sent"] },
        dueDate: { $lt: new Date() },
        isDeleted: false,
      }),
      Task.find({
        organizationId: orgObjectId,
        assigneeId: { $in: employeeIds },
        status: "overdue",
        isDeleted: false,
      }),
      BuddyAssignment.find({
        organizationId: orgObjectId,
        menteeUserId: { $in: employeeIds },
        status: "active",
      }),
    ]);

    const buddyMap = new Set(buddyAssignments.map((b: any) => b.menteeUserId.toString()));

    const exceptions: Array<{
      employee: any;
      riskLevel: "critical" | "high" | "medium";
      issues: string[];
    }> = [];

    for (const emp of activeEmployees) {
      const empIdStr = emp._id.toString();
      const issues: string[] = [];

      const empOverdueJourneys = overdueAssignments.filter((a) => a.employeeId.toString() === empIdStr);
      if (empOverdueJourneys.length > 0) {
        issues.push(`${empOverdueJourneys.length} overdue learning journey(s)`);
      }

      const empOverdueDocs = pendingDocs.filter((d: any) => d.recipientUserId.toString() === empIdStr);
      if (empOverdueDocs.length > 0) {
        issues.push(`${empOverdueDocs.length} overdue e-signature document(s)`);
      }

      const empOverdueTasks = overdueTasks.filter((t: any) => t.assigneeId?.toString() === empIdStr);
      if (empOverdueTasks.length > 0) {
        issues.push(`${empOverdueTasks.length} overdue onboarding task(s)`);
      }

      if (!buddyMap.has(empIdStr)) {
        issues.push("No assigned onboarding buddy");
      }

      if (issues.length > 0) {
        const riskLevel = issues.length >= 3 ? "critical" : issues.length === 2 ? "high" : "medium";
        exceptions.push({
          employee: {
            _id: emp._id,
            name: `${emp.profile?.firstName} ${emp.profile?.lastName}`,
            email: emp.auth.email,
            department: emp.employment?.department || "Unassigned",
            jobTitle: emp.employment?.jobTitle || "Employee",
          },
          riskLevel,
          issues,
        });
      }
    }

    return exceptions;
  }

  /**
   * Employee Lifecycle Controls & Offboarding/Pause Actions (HR-002)
   */
  async updateLifecycleState(
    orgId: string | mongoose.Types.ObjectId,
    targetUserId: string | mongoose.Types.ObjectId,
    state: "active" | "paused" | "completed" | "archived",
    reason?: string,
    extensionDays?: number
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const userObjectId = new mongoose.Types.ObjectId(targetUserId);

    const user = await User.findOne({
      _id: userObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    if (!user.employment) {
      user.employment = {} as any;
    }

    user.employment.onboardingState = state;
    user.employment.onboardingStateReason = reason;

    if (state === "paused") {
      user.employment.onboardingPausedAt = new Date();
    }

    await user.save();

    // Extend due dates if extensionDays requested
    if (extensionDays && extensionDays > 0) {
      const addedMs = extensionDays * 24 * 60 * 60 * 1000;

      const activeAssignments = await EmployeeAssignment.find({
        organizationId: orgObjectId,
        employeeId: userObjectId,
        status: { $in: ["assigned", "in_progress", "overdue"] },
        isDeleted: false,
      });

      for (const assignment of activeAssignments) {
        if (assignment.assignment?.dueDate) {
          assignment.assignment.dueDate = new Date(assignment.assignment.dueDate.getTime() + addedMs);
        } else {
          assignment.assignment.dueDate = new Date(Date.now() + addedMs);
        }
        if (assignment.status === "overdue") {
          assignment.status = "in_progress";
        }
        await assignment.save();
      }
    }

    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: targetUserId,
      type: "system",
      title: `Onboarding Status Updated: ${state.toUpperCase()}`,
      message: `Your onboarding state was updated to "${state}". ${reason ? `Reason: ${reason}` : ""}`,
      priority: "medium",
    });

    return user;
  }

  /**
   * Bulk Employee Batch Operations (HR-003)
   */
  async executeBulkAction(
    orgId: string | mongoose.Types.ObjectId,
    actorUserId: string | mongoose.Types.ObjectId,
    action: "assign_journey" | "request_document" | "send_reminder",
    employeeIds: string[],
    payload: { journeyId?: string; templateId?: string; message?: string }
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const recipientObjectIds = employeeIds.map((id) => new mongoose.Types.ObjectId(id));

    let processedCount = 0;

    if (action === "send_reminder") {
      for (const empId of recipientObjectIds) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: empId,
          type: "journey_assigned",
          title: "HR Onboarding Nudge",
          message: payload.message || "Please complete your pending onboarding tasks and learning journeys.",
          priority: "high",
        });
        processedCount++;
      }
    } else if (action === "assign_journey" && payload.journeyId) {
      const journeyObjectId = new mongoose.Types.ObjectId(payload.journeyId);
      for (const empId of recipientObjectIds) {
        const existing = await EmployeeAssignment.findOne({
          organizationId: orgObjectId,
          employeeId: empId,
          "journey.journeyId": journeyObjectId,
          isDeleted: false,
        });

        if (!existing) {
          await EmployeeAssignment.create({
            organizationId: orgObjectId,
            employeeId: empId,
            journeyId: journeyObjectId,
            journey: {
              journeyId: journeyObjectId,
              title: "Bulk Assigned Journey",
              version: 1,
            },
            assignedBy: new mongoose.Types.ObjectId(actorUserId),
            assignment: {
              assignedAt: new Date(),
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              priority: "normal",
            },
            status: "assigned",
            progress: {
              totalModules: 1,
              completedModules: 0,
              totalLessons: 1,
              completedLessons: 0,
              completionPercentage: 0,
              totalTimeSpentSeconds: 0,
            },
          });
          processedCount++;
        }
      }
    }

    return { processedCount };
  }

  /**
   * Operational HR Audit Compliance Report (HR-005)
   */
  async generateComplianceReport(orgId: string | mongoose.Types.ObjectId) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    const employees = await User.find({
      organizationId: orgObjectId,
      "permissions.role": "employee",
      isDeleted: false,
    }).select("profile auth employment");

    const assignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      isDeleted: false,
    });

    const report = employees.map((emp) => {
      const empAssignments = assignments.filter((a) => a.employeeId.toString() === emp._id.toString());
      const completedCount = empAssignments.filter((a) => a.status === "completed").length;
      const totalCount = empAssignments.length;
      const completionRate = totalCount ? Math.round((completedCount / totalCount) * 100) : 100;

      return {
        employeeId: emp._id,
        name: `${emp.profile?.firstName} ${emp.profile?.lastName}`,
        email: emp.auth.email,
        department: emp.employment?.department || "Unassigned",
        onboardingState: emp.employment?.onboardingState || "active",
        totalAssigned: totalCount,
        totalCompleted: completedCount,
        completionRate,
      };
    });

    return report;
  }
}

export const hrOperationsService = new HROperationsService();
export default hrOperationsService;
