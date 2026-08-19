import mongoose from "mongoose";
import MilestoneTemplate, { IMilestoneTemplate } from "../models/milestone-template.model.js";
import EmployeeMilestone, { IEmployeeMilestone } from "../models/employee-milestone.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";

const notificationService = new NotificationService(new NotificationRepository());

export class MilestoneService {
  /**
   * Create Milestone Template
   */
  async createTemplate(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: Partial<IMilestoneTemplate>
  ) {
    const template = await MilestoneTemplate.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      title: data.title,
      description: data.description,
      targetDay: data.targetDay || 30,
      goals: data.goals || [],
      checkinQuestions: data.checkinQuestions || [],
      audience: data.audience || {},
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    return template;
  }

  /**
   * List Milestone Templates
   */
  async listTemplates(orgId: string | mongoose.Types.ObjectId) {
    return MilestoneTemplate.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    }).sort({ targetDay: 1 });
  }

  /**
   * Assign Milestone Template to Employee using Hire-Date relative scheduling
   */
  async assignMilestone(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    assignedByUserId: string | mongoose.Types.ObjectId
  ) {
    const template = await MilestoneTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });
    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Milestone template not found");
    }

    const employee = await User.findOne({
      _id: new mongoose.Types.ObjectId(employeeId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });
    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Employee not found");
    }

    // Calculate due date based on employee hire date + targetDay offset
    const hireDate = employee.employment?.hireDate ? new Date(employee.employment.hireDate) : new Date();
    const dueDate = new Date(hireDate.getTime() + template.targetDay * 24 * 60 * 60 * 1000);

    const goalsProgress = template.goals.map((g) => ({
      goalTitle: g.title,
      completed: false,
    }));

    const milestone = await EmployeeMilestone.create({
      organizationId: new mongoose.Types.ObjectId(orgId),
      templateId: template._id,
      employeeId: new mongoose.Types.ObjectId(employeeId),
      assignedBy: new mongoose.Types.ObjectId(assignedByUserId),
      milestoneTitle: template.title,
      targetDay: template.targetDay,
      dueDate,
      status: "pending",
      goalsProgress,
    });

    return milestone;
  }

  /**
   * List employee 30/60/90-day milestones
   */
  async getEmployeeMilestones(orgId: string | mongoose.Types.ObjectId, employeeId: string | mongoose.Types.ObjectId) {
    return EmployeeMilestone.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    }).sort({ targetDay: 1 });
  }

  /**
   * List team 30/60/90-day milestones for a manager
   */
  async getManagerTeamMilestones(
    orgId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(orgId);

    let directReportIds: mongoose.Types.ObjectId[] = [];
    if (role === "manager") {
      const reports = await User.find({
        organizationId: orgObjectId,
        "employment.managerId": new mongoose.Types.ObjectId(managerUserId),
        isDeleted: false,
      }).select("_id");
      directReportIds = reports.map((r) => r._id);
    } else {
      const reports = await User.find({ organizationId: orgObjectId, isDeleted: false }).select("_id");
      directReportIds = reports.map((r) => r._id);
    }

    return EmployeeMilestone.find({
      organizationId: orgObjectId,
      employeeId: { $in: directReportIds },
      isDeleted: false,
    })
      .populate("employeeId", "profile auth employment")
      .sort({ dueDate: 1 });
  }

  /**
   * Submit Employee Self Check-In (S90-003)
   */
  async submitEmployeeSelfCheck(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    payload: {
      responses: Array<{ questionId: string; question: string; answer: string }>;
      confidenceRating?: number;
      comments?: string;
      goalsCompletedTitles?: string[];
    }
  ) {
    const milestone = await EmployeeMilestone.findOne({
      _id: new mongoose.Types.ObjectId(milestoneId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      employeeId: new mongoose.Types.ObjectId(employeeId),
      isDeleted: false,
    });

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    // Update goals progress
    if (payload.goalsCompletedTitles) {
      const completedSet = new Set(payload.goalsCompletedTitles);
      milestone.goalsProgress.forEach((g) => {
        if (completedSet.has(g.goalTitle)) {
          g.completed = true;
          g.completedAt = new Date();
        }
      });
    }

    milestone.employeeSelfCheck = {
      completedAt: new Date(),
      responses: payload.responses.map((r) => ({
        questionId: new mongoose.Types.ObjectId(r.questionId),
        question: r.question,
        answer: r.answer,
      })),
      confidenceRating: payload.confidenceRating || 4,
      comments: payload.comments,
    };

    milestone.status = "in_review";
    await milestone.save();

    // Notify manager
    const employee = await User.findById(employeeId);
    if (employee?.employment?.managerId) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: employee.employment.managerId,
        type: "journey_completed",
        title: `30/60/90 Milestone Self Check-In Submitted`,
        message: `${employee.profile?.firstName} ${employee.profile?.lastName} has completed their Day ${milestone.targetDay} milestone check-in. Please review and provide feedback.`,
        priority: "high",
      });
    }

    return milestone;
  }

  /**
   * Submit Manager Review & Approval (S90-004, S90-005)
   */
  async submitManagerReview(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string,
    payload: {
      approvalStatus: "approved" | "needs_action";
      performanceRating?: number;
      feedback?: string;
    }
  ) {
    const milestone = await EmployeeMilestone.findOne({
      _id: new mongoose.Types.ObjectId(milestoneId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    const employee = await User.findById(milestone.employeeId);

    // Security check: Manager can only review their direct reports
    if (role === "manager" && employee?.employment?.managerId?.toString() !== managerUserId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only review milestones for your direct reports");
    }

    milestone.managerReview = {
      reviewedBy: new mongoose.Types.ObjectId(managerUserId),
      reviewedAt: new Date(),
      approvalStatus: payload.approvalStatus,
      performanceRating: payload.performanceRating || 5,
      feedback: payload.feedback,
    };

    if (payload.approvalStatus === "approved") {
      milestone.status = "completed";
    }

    await milestone.save();

    // Notify employee
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: milestone.employeeId,
      type: "journey_completed",
      title: `Day ${milestone.targetDay} Milestone Review Approved!`,
      message: `Your manager has reviewed and approved your Day ${milestone.targetDay} milestone program. Feedback: ${payload.feedback || "Great job!"}`,
      priority: "high",
    });

    return milestone;
  }

  /**
   * Event-driven auto-assignment of 30, 60, and 90-day milestone programs for new hires
   */
  async autoAssignMilestonesToNewHire(
    orgId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<number> {
    const templates = await MilestoneTemplate.find({
      organizationId: new mongoose.Types.ObjectId(orgId),
      "audience.autoAssignNewHires": true,
      isDeleted: false,
    });

    let assignedCount = 0;

    // Default 30, 60, 90 day milestones if no templates exist
    if (templates.length === 0) {
      const defaultDays: Array<30 | 60 | 90> = [30, 60, 90];
      for (const day of defaultDays) {
        const defaultTemplate = await this.createTemplate(orgId, userId, {
          title: `Day ${day} Onboarding Milestone`,
          targetDay: day,
          goals: [
            { title: `Complete Day ${day} core competencies and learning journeys` },
            { title: "Conduct 1-on-1 feedback alignment with manager" },
          ],
          checkinQuestions: [
            { question: "What were your biggest wins and key learnings over this period?", type: "text", required: true },
            { question: "Do you have all tools and support needed for your role?", type: "boolean", required: true },
          ],
          audience: { autoAssignNewHires: true },
        });

        await this.assignMilestone(orgId, defaultTemplate._id, userId, userId);
        assignedCount++;
      }
    } else {
      for (const template of templates) {
        try {
          await this.assignMilestone(orgId, template._id, userId, template.createdBy);
          assignedCount++;
        } catch (err: any) {
          // Skip error
        }
      }
    }

    return assignedCount;
  }
}

export const milestoneService = new MilestoneService();
export default milestoneService;
