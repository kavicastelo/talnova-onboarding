import mongoose from "mongoose";
import User, { IUser } from "../../auth/models/user.model.js";
import EmployeeAssignment from "../../assignments/models/assignment.model.js";
import Task from "../../tasks/models/task.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export interface ManagerDashboardMetrics {
  totalDirectReports: number;
  activeOnboardingCount: number;
  overallCompletionRate: number;
  overdueItemsCount: number;
  recentActivities: Array<{
    id: string;
    employeeName: string;
    type: "journey_completed" | "task_completed" | "nudge_sent" | "signed_off";
    title: string;
    timestamp: Date;
  }>;
}

export interface DirectReportSummary {
  _id: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  hireDate?: Date;
  status: string;
  journeyStats: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    completionPercentage: number;
  };
  taskStats: {
    totalAssigned: number;
    completed: number;
    overdue: number;
  };
  hasOverdueItems: boolean;
  signedOffAt?: Date;
  signedOffNotes?: string;
}

export class ManagerService {
  /**
   * Filter users based on manager role & direct report boundary
   */
  private buildDirectReportQuery(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const query: Record<string, any> = {
      organizationId: orgObjectId,
      isDeleted: false,
    };

    // If user is a manager (not admin/owner), strictly enforce direct-report filter
    if (role === "manager") {
      query["employment.managerId"] = new mongoose.Types.ObjectId(managerUserId);
    }

    return query;
  }

  /**
   * Aggregates Manager Dashboard summary stats
   */
  async getManagerDashboard(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string
  ): Promise<ManagerDashboardMetrics> {
    const userQuery = this.buildDirectReportQuery(orgId, managerUserId, role);
    const directReports = await User.find(userQuery).select("_id profile employment auth");

    const directReportIds = directReports.map((u) => u._id);
    const totalDirectReports = directReports.length;

    if (totalDirectReports === 0) {
      return {
        totalDirectReports: 0,
        activeOnboardingCount: 0,
        overallCompletionRate: 100,
        overdueItemsCount: 0,
        recentActivities: [],
      };
    }

    // Fetch assignments for direct reports
    const assignments = await EmployeeAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: { $in: directReportIds },
    });

    // Fetch tasks for direct reports
    const tasks = await Task.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      $or: [
        { assignedToUserId: { $in: directReportIds } },
        { employeeId: { $in: directReportIds } },
        { assigneeId: { $in: directReportIds } },
      ],
      isDeleted: false,
    });

    const activeOnboardingCount = directReports.filter(
      (u) => u.employment?.status === "onboarding" || u.employment?.status === "active"
    ).length;

    let totalCompletionPercentage = 0;
    assignments.forEach((a) => {
      totalCompletionPercentage += a.progress?.completionPercentage || 0;
    });

    const overallCompletionRate =
      assignments.length > 0 ? Math.round(totalCompletionPercentage / assignments.length) : 0;

    const overdueAssignments = assignments.filter(
      (a) => a.status === "overdue" || (a.assignment.dueDate && new Date(a.assignment.dueDate) < new Date() && a.status !== "completed")
    ).length;

    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed"
    ).length;

    const overdueItemsCount = overdueAssignments + overdueTasks;

    // Collect recent activities
    const recentActivities: ManagerDashboardMetrics["recentActivities"] = [];

    assignments
      .filter((a) => a.status === "completed" && a.completedAt)
      .slice(0, 5)
      .forEach((a) => {
        const emp = directReports.find((u) => u._id.toString() === a.employeeId.toString());
        recentActivities.push({
          id: a._id.toString(),
          employeeName: emp ? `${emp.profile?.firstName} ${emp.profile?.lastName}` : "Direct Report",
          type: "journey_completed",
          title: `Completed journey "${a.journey.title}"`,
          timestamp: a.completedAt!,
        });
      });

    return {
      totalDirectReports,
      activeOnboardingCount,
      overallCompletionRate,
      overdueItemsCount,
      recentActivities: recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    };
  }

  /**
   * Returns roster of direct reports with progress summaries
   */
  async getTeamDirectReports(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string
  ): Promise<DirectReportSummary[]> {
    const userQuery = this.buildDirectReportQuery(orgId, managerUserId, role);
    const directReports = await User.find(userQuery).select("_id profile employment auth permissions");

    const directReportIds = directReports.map((u) => u._id);

    const assignments = await EmployeeAssignment.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: { $in: directReportIds },
    });

    const tasks = await Task.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      $or: [
        { assignedToUserId: { $in: directReportIds } },
        { employeeId: { $in: directReportIds } },
        { assigneeId: { $in: directReportIds } },
      ],
      isDeleted: false,
    });

    return directReports.map((user) => {
      const empIdStr = user._id.toString();
      const empAssignments = assignments.filter((a) => a.employeeId.toString() === empIdStr);
      const empTasks = tasks.filter(
        (t) =>
          t.assignedToUserId?.toString() === empIdStr ||
          t.employeeId?.toString() === empIdStr ||
          (t as any).assigneeId?.toString() === empIdStr
      );

      const totalAssignedJourneys = empAssignments.length;
      const completedJourneys = empAssignments.filter((a) => a.status === "completed").length;
      const inProgressJourneys = empAssignments.filter((a) => a.status === "in_progress" || a.status === "assigned").length;

      let totalPct = 0;
      empAssignments.forEach((a) => {
        totalPct += a.progress?.completionPercentage || 0;
      });
      const avgCompletionPct = totalAssignedJourneys > 0 ? Math.round(totalPct / totalAssignedJourneys) : 0;

      const totalAssignedTasks = empTasks.length;
      const completedTasks = empTasks.filter((t) => t.status === "completed").length;
      const overdueTasks = empTasks.filter(
        (t) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed"
      ).length;

      const overdueJourneys = empAssignments.filter(
        (a) => a.status === "overdue" || (a.assignment.dueDate && new Date(a.assignment.dueDate) < new Date() && a.status !== "completed")
      ).length;

      const hasOverdueItems = overdueTasks > 0 || overdueJourneys > 0;

      return {
        _id: empIdStr,
        fullName: `${user.profile?.firstName} ${user.profile?.lastName}`,
        email: user.auth?.email || "",
        jobTitle: user.employment?.jobTitle || user.employment?.designation,
        department: user.employment?.department,
        location: user.profile?.location,
        hireDate: user.employment?.hireDate,
        status: user.employment?.status || "active",
        journeyStats: {
          totalAssigned: totalAssignedJourneys,
          completed: completedJourneys,
          inProgress: inProgressJourneys,
          completionPercentage: avgCompletionPct,
        },
        taskStats: {
          totalAssigned: totalAssignedTasks,
          completed: completedTasks,
          overdue: overdueTasks,
        },
        hasOverdueItems,
      };
    });
  }

  /**
   * Deep-dive employee details for a specific direct report
   */
  async getDirectReportDetails(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string,
    employeeId: string | mongoose.Types.ObjectId
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);
    const empObjectId = new mongoose.Types.ObjectId(employeeId);

    const employee = await User.findOne({
      _id: empObjectId,
      organizationId: orgObjectId,
      isDeleted: false,
    }).select("-auth.passwordHash");

    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    // Security check: If role is manager, enforce that target employee is their direct report
    if (role === "manager") {
      const isDirectReport = employee.employment?.managerId?.toString() === managerUserId.toString();
      if (!isDirectReport) {
        throw new AppError(403, "FORBIDDEN", "You can only access details for your direct reports");
      }
    }

    const assignments = await EmployeeAssignment.find({
      organizationId: orgObjectId,
      employeeId: empObjectId,
    });

    const tasks = await Task.find({
      organizationId: orgObjectId,
      $or: [{ assignedToUserId: empObjectId }, { employeeId: empObjectId }],
      isDeleted: false,
    });

    return {
      employee: {
        _id: employee._id.toString(),
        fullName: `${employee.profile?.firstName} ${employee.profile?.lastName}`,
        email: employee.auth?.email,
        jobTitle: employee.employment?.jobTitle || employee.employment?.designation,
        department: employee.employment?.department,
        hireDate: employee.employment?.hireDate,
        status: employee.employment?.status,
        managerId: employee.employment?.managerId,
      },
      assignments: assignments.map((a) => ({
        _id: a._id.toString(),
        journeyTitle: a.journey.title,
        journeyVersion: a.journey.version,
        status: a.status,
        dueDate: a.assignment.dueDate,
        assignedAt: a.assignment.assignedAt,
        progress: a.progress,
        modules: a.modules,
      })),
      tasks: tasks.map((t) => ({
        _id: t._id.toString(),
        title: t.title,
        description: t.description,
        category: t.category,
        status: t.status,
        dueDate: t.dueDate,
        priority: t.priority,
      })),
    };
  }

  /**
   * Send instant nudge/reminder to direct report
   */
  async nudgeDirectReport(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string,
    employeeId: string | mongoose.Types.ObjectId,
    customMessage?: string
  ) {
    const details = await this.getDirectReportDetails(orgId, managerUserId, role, employeeId);

    const messageText =
      customMessage ||
      `Your manager sent a friendly nudge regarding your onboarding tasks and learning journeys. Please log in to complete your pending items!`;

    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "journey_assigned",
      title: "Onboarding Nudge from Manager",
      message: messageText,
      priority: "high",
      data: { managerUserId, type: "manager_nudge" },
    });

    return {
      success: true,
      message: `Nudge successfully sent to ${details.employee.fullName}`,
    };
  }

  /**
   * Manager sign-off on direct report's onboarding completion
   */
  async signOffDirectReport(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string,
    employeeId: string | mongoose.Types.ObjectId,
    notes?: string
  ) {
    const details = await this.getDirectReportDetails(orgId, managerUserId, role, employeeId);

    // Update user employment status to active upon manager sign-off
    await User.updateOne(
      { _id: new mongoose.Types.ObjectId(employeeId), organizationId: new mongoose.Types.ObjectId(orgId) },
      {
        $set: {
          "employment.status": "active",
        },
      }
    );

    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "journey_completed",
      title: "Onboarding Sign-Off Approved!",
      message: `Congratulations! Your manager has formally signed off on your onboarding program. ${notes ? `Notes: ${notes}` : ""}`,
      priority: "high",
      data: { managerUserId, signedOffAt: new Date() },
    });

    return {
      success: true,
      signedOffAt: new Date(),
      signedOffBy: managerUserId,
      message: `Onboarding program for ${details.employee.fullName} has been successfully signed off!`,
    };
  }
}

export const managerService = new ManagerService();
export default managerService;
