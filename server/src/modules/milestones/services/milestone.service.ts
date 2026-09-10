import mongoose from "mongoose";
import MilestoneTemplate, { IMilestoneTemplate } from "../models/milestone-template.model.js";
import EmployeeMilestone, { IEmployeeMilestone } from "../models/employee-milestone.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import eventBus from "../../../infrastructure/events/event-bus.js";

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
      const managerObjId = new mongoose.Types.ObjectId(managerUserId);
      const reports = await User.find({
        organizationId: orgObjectId,
        $or: [
          { "employment.managerId": managerObjId },
          { "employment.managerUserId": managerObjId },
        ],
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
   * Submit Employee Self Check-In / Self-Evaluation (S90-003)
   */
  async submitEmployeeSelfCheck(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    payload: {
      responses?: Array<{ questionId?: string; question?: string; answer?: string }>;
      confidenceRating?: number;
      employeeRating?: number;
      comments?: string;
      reflectionNotes?: string;
      goalsCompletedTitles?: string[];
    }
  ) {
    let filter: any = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    };
    if (typeof milestoneId === "string" && (!mongoose.Types.ObjectId.isValid(milestoneId) || milestoneId.length !== 24)) {
      filter.$or = [{ milestoneCode: milestoneId }, { customId: milestoneId }];
    } else {
      filter._id = new mongoose.Types.ObjectId(milestoneId);
    }

    const milestone = await EmployeeMilestone.findOne(filter);

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    if (milestone.employeeId.toString() !== employeeId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You cannot submit an evaluation for another employee's milestone.");
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

    const rating = payload.employeeRating ?? payload.confidenceRating ?? 4;
    const comments = payload.comments || payload.reflectionNotes || "";
    const submittedDate = new Date();

    const responses = (payload.responses || []).map((r) => ({
      questionId: r.questionId && mongoose.Types.ObjectId.isValid(r.questionId) ? new mongoose.Types.ObjectId(r.questionId) : new mongoose.Types.ObjectId(),
      question: r.question || "Confidence in Role",
      answer: r.answer || String(rating),
    }));

    milestone.employeeSelfCheck = {
      completedAt: submittedDate,
      submittedAt: submittedDate,
      responses,
      confidenceRating: rating,
      employeeRating: rating,
      comments,
      reflectionNotes: comments,
    };

    milestone.employeeRating = rating;
    milestone.submittedAt = submittedDate;
    milestone.comments = comments;
    milestone.status = "pending_manager_review";
    await milestone.save();

    // Notify manager
    const employee = await User.findById(employeeId);
    const managerId = employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;
    if (managerId) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: managerId,
        type: "journey_completed",
        title: `Day ${milestone.targetDay} Milestone Evaluation Submitted`,
        message: `${employee?.profile?.firstName || "Employee"} ${employee?.profile?.lastName || ""} has submitted their Day ${milestone.targetDay} self-evaluation (Rating: ${rating}/5). Please review and provide manager sign-off.`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          employeeId: employeeId.toString(),
          targetDay: milestone.targetDay,
          rating,
        },
      });
    }

    return milestone;
  }

  /**
   * Evaluate Milestone & Sign-Off (UJ-MGR-002 / S90-004, S90-005)
   */
  async evaluateMilestone(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    managerUserId: string | mongoose.Types.ObjectId,
    role: string,
    payload: {
      status?: "approved" | "needs_action" | "revision_requested" | "completed";
      approvalStatus?: "approved" | "needs_action" | "revision_requested" | "completed";
      managerRating?: number;
      performanceRating?: number;
      rating?: number;
      managerFeedback?: string;
      feedback?: string;
      notes?: string;
    }
  ) {
    let filter: any = {
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    };
    if (typeof milestoneId === "string" && (!mongoose.Types.ObjectId.isValid(milestoneId) || milestoneId.length !== 24)) {
      filter.$or = [{ milestoneCode: milestoneId }, { customId: milestoneId }];
    } else {
      filter._id = new mongoose.Types.ObjectId(milestoneId);
    }

    const milestone = await EmployeeMilestone.findOne(filter);

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    const employee = await User.findById(milestone.employeeId);
    const managerId = employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;

    // Security check: Manager can only review their direct reports
    if (role === "manager" && managerId?.toString() !== managerUserId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only review milestones for your direct reports");
    }

    // Rating validation
    const rating = payload.managerRating ?? payload.performanceRating ?? payload.rating;
    if (rating !== undefined && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      throw new AppError(400, "VALIDATION_ERROR", "Rating must be between 1 and 5");
    }

    const statusInput = payload.status || payload.approvalStatus || "approved";
    const isRevision = statusInput === "revision_requested" || statusInput === "needs_action";
    const finalStatus = isRevision ? "revision_requested" : "approved";
    const feedback = payload.managerFeedback || payload.feedback || payload.notes || "";
    const evaluatedDate = new Date();
    const finalRating = rating !== undefined ? rating : 5;

    milestone.status = finalStatus;
    milestone.managerRating = finalRating;
    milestone.managerFeedback = feedback;
    milestone.evaluatedAt = evaluatedDate;

    milestone.managerReview = {
      reviewedBy: new mongoose.Types.ObjectId(managerUserId),
      reviewedAt: evaluatedDate,
      approvalStatus: isRevision ? "needs_action" : "approved",
      performanceRating: finalRating,
      feedback,
    };

    if (!isRevision) {
      // Publish event
      try {
        await eventBus.publish({
          eventName: "ON_MILESTONE_EVALUATED" as any,
          organizationId: orgId,
          actorId: managerUserId,
          entityId: milestone._id as any,
          payload: {
            milestoneId: milestone._id.toString(),
            templateId: milestone.templateId.toString(),
            milestoneTitle: milestone.milestoneTitle,
            employeeId: milestone.employeeId.toString(),
            targetDay: milestone.targetDay,
            managerRating: finalRating,
            status: "approved",
          },
        });
        await eventBus.publish({
          eventName: "MILESTONE_COMPLETED",
          organizationId: orgId,
          actorId: managerUserId,
          entityId: milestone._id as any,
          payload: {
            milestoneId: milestone._id.toString(),
            templateId: milestone.templateId.toString(),
            milestoneTitle: milestone.milestoneTitle,
            employeeId: milestone.employeeId.toString(),
            targetDay: milestone.targetDay,
          },
        });
      } catch (e) {
        console.error("Failed to publish milestone events:", e);
      }
    }

    await milestone.save();

    // Notify employee
    if (!isRevision) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: milestone.employeeId,
        type: "journey_completed",
        title: `Day ${milestone.targetDay} Milestone Approved!`,
        message: `Your Day ${milestone.targetDay} milestone has been approved by your manager. Feedback: ${feedback || "Exceeded expectations on ramp-up. Completed initial project ahead of schedule."}`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          targetDay: milestone.targetDay,
          status: "approved",
        },
      });
    } else {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: milestone.employeeId,
        type: "journey_completed",
        title: `Revision Requested: Day ${milestone.targetDay} Milestone`,
        message: `Your manager requested revisions on your Day ${milestone.targetDay} milestone. Notes: ${feedback || "Please review and update your self-reflection."}`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          targetDay: milestone.targetDay,
          status: "revision_requested",
        },
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
    payload: any
  ) {
    return this.evaluateMilestone(orgId, milestoneId, managerUserId, role, payload);
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
