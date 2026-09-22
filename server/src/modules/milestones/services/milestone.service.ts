import mongoose from "mongoose";
import MilestoneTemplate, { IMilestoneTemplate } from "../models/milestone-template.model.js";
import EmployeeMilestone, { IEmployeeMilestone } from "../models/employee-milestone.model.js";
import User from "../../auth/models/user.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import eventBus from "../../../infrastructure/events/event-bus.js";
import { AIAssistantService } from "../../ai/services/ai-assistant.service.js";

const notificationService = new NotificationService(new NotificationRepository());
const aiAssistantService = new AIAssistantService();

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
      autoApprovalEnabled: data.autoApprovalEnabled !== undefined ? data.autoApprovalEnabled : true,
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
   * Update Milestone Template
   */
  async updateTemplate(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    data: Partial<IMilestoneTemplate>
  ) {
    const template = await MilestoneTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Milestone template not found");
    }

    if (data.title !== undefined) template.title = data.title;
    if (data.description !== undefined) template.description = data.description;
    if (data.targetDay !== undefined) template.targetDay = data.targetDay;
    if (data.goals !== undefined) template.goals = data.goals as any;
    if (data.checkinQuestions !== undefined) template.checkinQuestions = data.checkinQuestions as any;
    if (data.audience !== undefined) template.audience = data.audience as any;
    template.updatedBy = new mongoose.Types.ObjectId(userId);

    await template.save();
    return template;
  }

  /**
   * Delete Milestone Template (Soft delete)
   */
  async deleteTemplate(
    orgId: string | mongoose.Types.ObjectId,
    templateId: string | mongoose.Types.ObjectId
  ) {
    const template = await MilestoneTemplate.findOne({
      _id: new mongoose.Types.ObjectId(templateId),
      organizationId: new mongoose.Types.ObjectId(orgId),
      isDeleted: false,
    });

    if (!template) {
      throw new AppError(404, "NOT_FOUND", "Milestone template not found");
    }

    template.isDeleted = true;
    template.deletedAt = new Date();
    await template.save();

    return { success: true, message: "Milestone template deleted successfully" };
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

    const employeeName = `${employee.profile?.firstName || ""} ${employee.profile?.lastName || ""}`.trim() || "Employee";
    const managerId = employee.employment?.managerId || (employee.employment as any)?.managerUserId;

    // 1. Notify responsible user (Employee)
    notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "milestone_assigned",
      title: `New Onboarding Milestone: Day ${template.targetDay}`,
      message: `You have been scheduled for Day ${template.targetDay} milestone: "${template.title}". Target due date: ${dueDate.toLocaleDateString()}.`,
      priority: "medium",
      data: {
        milestoneId: milestone._id.toString(),
        targetDay: template.targetDay,
        deepLink: "/milestones",
      },
    }).catch((err) => console.warn("[MilestoneService] Employee milestone notification error:", err));

    // 2. Notify relevant user (Manager)
    if (managerId && managerId.toString() !== employeeId.toString()) {
      notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: managerId,
        type: "milestone_assigned",
        title: `Milestone Scheduled for ${employeeName}`,
        message: `Day ${template.targetDay} milestone "${template.title}" has been scheduled for ${employeeName} (Due: ${dueDate.toLocaleDateString()}).`,
        priority: "medium",
        data: {
          milestoneId: milestone._id.toString(),
          employeeId: employeeId.toString(),
          targetDay: template.targetDay,
          deepLink: "/milestones/team",
        },
      }).catch((err) => console.warn("[MilestoneService] Manager milestone notification error:", err));
    }

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

    // Milestone SLA & Escalation Ladder (Prompt 06 Step 1)
    const template = await MilestoneTemplate.findById(milestone.templateId);
    const templateAllowsAutoApproval = template?.autoApprovalEnabled !== false;

    const lower = comments.toLowerCase();
    const blockersReported =
      lower.includes("block") ||
      lower.includes("stuck") ||
      lower.includes("issue") ||
      lower.includes("struggl") ||
      lower.includes("difficult") ||
      lower.includes("delay") ||
      lower.includes("help needed") ||
      lower.includes("impediment");

    // Guardrail: High confidence (>=4/5) and 0 blockers -> autoApprovalEligible
    // Low score (<=2/5) or negative sentiment/blockers -> autoApprovalEligible: false
    const autoApprovalEligible = rating >= 4 && !blockersReported && templateAllowsAutoApproval;

    milestone.sla = {
      reviewDeadline: new Date(submittedDate.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days review window
      reminderSentCount: 0,
      autoApprovalEligible,
      escalationState: "normal",
      blockersReported,
    };

    // AI-Powered Reflection Summarization (Prompt 06 Step 2)
    const employee = await User.findById(employeeId);
    try {
      const aiSummary = await aiAssistantService.summarizeReflection(comments, {
        employeeName: employee?.profile?.firstName,
        rating,
        targetDay: milestone.targetDay,
        organizationId: orgId,
      });
      milestone.aiSummary = aiSummary;
    } catch (aiErr) {
      console.warn("[MilestoneService] AI reflection summarization failed:", aiErr);
    }

    await milestone.save();

    // 1. Notify responsible user (Employee: confirmation)
    await notificationService.createNotification({
      organizationId: orgId,
      recipientUserId: employeeId,
      type: "milestone_submitted",
      title: `Day ${milestone.targetDay} Self-Evaluation Submitted`,
      message: `Your Day ${milestone.targetDay} self-evaluation has been submitted to your manager for review.`,
      priority: "medium",
      data: {
        milestoneId: milestone._id.toString(),
        targetDay: milestone.targetDay,
        rating,
        deepLink: "/milestones",
      },
    }).catch((err) => console.warn("[MilestoneService] Employee confirmation notification error:", err));

    // 2. Notify relevant user (Manager: review request)
    const managerId = employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;
    if (managerId) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: managerId,
        type: "milestone_submitted",
        title: `Day ${milestone.targetDay} Milestone Evaluation Submitted`,
        message: `${employee?.profile?.firstName || "Employee"} ${employee?.profile?.lastName || ""} has submitted their Day ${milestone.targetDay} self-evaluation (Rating: ${rating}/5). Please review and provide manager sign-off.`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          employeeId: employeeId.toString(),
          targetDay: milestone.targetDay,
          rating,
          deepLink: "/milestones/team",
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
    const employeeName = `${employee?.profile?.firstName || ""} ${employee?.profile?.lastName || ""}`.trim() || "Employee";
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

    if (milestone.sla) {
      milestone.sla.escalationState = "normal";
    }
    milestone.approvedBy = isRevision ? undefined : new mongoose.Types.ObjectId(managerUserId);

    await milestone.save();

    // Dual-recipient notification: notify employee and manager
    if (!isRevision) {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: milestone.employeeId,
        type: "milestone_approved",
        title: `Day ${milestone.targetDay} Milestone Approved!`,
        message: `Your Day ${milestone.targetDay} milestone has been approved by your manager. Feedback: ${feedback || "Exceeded expectations on ramp-up."}`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          targetDay: milestone.targetDay,
          status: "approved",
          deepLink: "/milestones",
        },
      });

      if (managerUserId.toString() !== milestone.employeeId.toString()) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: managerUserId,
          type: "milestone_approved",
          title: `Milestone Approved: ${employeeName}`,
          message: `You successfully signed off on Day ${milestone.targetDay} milestone for ${employeeName}.`,
          priority: "medium",
          data: {
            milestoneId: milestone._id.toString(),
            employeeId: milestone.employeeId.toString(),
            targetDay: milestone.targetDay,
            status: "approved",
            deepLink: "/milestones/team",
          },
        }).catch((err) => console.warn("[MilestoneService] Manager evaluation notification error:", err));
      }
    } else {
      await notificationService.createNotification({
        organizationId: orgId,
        recipientUserId: milestone.employeeId,
        type: "milestone_revision_requested",
        title: `Revision Requested: Day ${milestone.targetDay} Milestone`,
        message: `Your manager requested revisions on your Day ${milestone.targetDay} milestone. Notes: ${feedback || "Please review and update your self-reflection."}`,
        priority: "high",
        data: {
          milestoneId: milestone._id.toString(),
          targetDay: milestone.targetDay,
          status: "revision_requested",
          deepLink: "/milestones",
        },
      });

      if (managerUserId.toString() !== milestone.employeeId.toString()) {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: managerUserId,
          type: "milestone_revision_requested",
          title: `Revision Requested for ${employeeName}`,
          message: `You requested revisions on Day ${milestone.targetDay} milestone for ${employeeName}.`,
          priority: "medium",
          data: {
            milestoneId: milestone._id.toString(),
            employeeId: milestone.employeeId.toString(),
            targetDay: milestone.targetDay,
            status: "revision_requested",
            deepLink: "/milestones/team",
          },
        }).catch((err) => console.warn("[MilestoneService] Manager revision notification error:", err));
      }
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
   * Get single milestone details with populated template and user info
   */
  async getMilestone(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    role: string
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

    const milestone = await EmployeeMilestone.findOne(filter)
      .populate("employeeId", "profile auth employment")
      .populate("templateId", "title description targetDay goals checkinQuestions audience")
      .populate("assignedBy", "profile auth");

    if (!milestone) {
      throw new AppError(404, "NOT_FOUND", "Milestone not found");
    }

    const targetEmpId = (milestone.employeeId as any)?._id?.toString() || milestone.employeeId?.toString();
    const isOwnerOrAdmin = ["owner", "admin", "hr_admin", "super_admin"].includes(role);

    if (role === "employee" && targetEmpId !== userId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only view your own milestones");
    }

    if (role === "manager" && !isOwnerOrAdmin && targetEmpId !== userId.toString()) {
      const targetUser = await User.findById(targetEmpId);
      const mgrId = targetUser?.employment?.managerId || (targetUser?.employment as any)?.managerUserId;
      if (mgrId?.toString() !== userId.toString()) {
        throw new AppError(403, "FORBIDDEN", "You can only view milestones for your direct reports");
      }
    }

    return milestone;
  }

  /**
   * Update milestone status directly (by admin, manager, or employee)
   */
  async updateMilestoneStatus(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    actorUserId: string | mongoose.Types.ObjectId,
    role: string,
    payload: {
      status: "pending" | "in_review" | "pending_manager_review" | "completed" | "approved" | "revision_requested";
      managerRating?: number;
      managerFeedback?: string;
      notes?: string;
      goalsProgress?: Array<{ goalTitle: string; completed: boolean }>;
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

    const targetEmpId = milestone.employeeId.toString();
    const isOwnerOrAdmin = ["owner", "admin", "hr_admin", "super_admin"].includes(role);

    const employee = await User.findById(milestone.employeeId);
    const employeeName = `${employee?.profile?.firstName || ""} ${employee?.profile?.lastName || ""}`.trim() || "Employee";
    const managerId = employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;

    if (role === "employee" && targetEmpId !== actorUserId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only modify your own milestone");
    }

    if (role === "manager" && !isOwnerOrAdmin && managerId?.toString() !== actorUserId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only modify milestones for your direct reports");
    }

    const newStatus = payload.status;
    milestone.status = newStatus;

    if (payload.goalsProgress && Array.isArray(payload.goalsProgress)) {
      const updatedMap = new Map(payload.goalsProgress.map((g) => [g.goalTitle, g.completed]));
      milestone.goalsProgress.forEach((g) => {
        if (updatedMap.has(g.goalTitle)) {
          g.completed = updatedMap.get(g.goalTitle)!;
          if (g.completed && !g.completedAt) g.completedAt = new Date();
        }
      });
    }

    if (payload.managerRating !== undefined) {
      milestone.managerRating = payload.managerRating;
    }

    const feedback = payload.managerFeedback || payload.notes;
    if (feedback !== undefined) {
      milestone.managerFeedback = feedback;
    }

    if (newStatus === "approved" || newStatus === "completed") {
      milestone.evaluatedAt = new Date();
      milestone.managerReview = {
        reviewedBy: new mongoose.Types.ObjectId(actorUserId),
        reviewedAt: new Date(),
        approvalStatus: "approved",
        performanceRating: payload.managerRating || milestone.managerRating || 5,
        feedback: feedback || milestone.managerFeedback || "Approved by administration.",
      };

      try {
        await eventBus.publish({
          eventName: "MILESTONE_COMPLETED",
          organizationId: orgId,
          actorId: actorUserId,
          entityId: milestone._id as any,
          payload: {
            milestoneId: milestone._id.toString(),
            employeeId: targetEmpId,
            targetDay: milestone.targetDay,
            title: milestone.milestoneTitle,
          },
        });
      } catch (err) {}
    } else if (newStatus === "revision_requested") {
      milestone.evaluatedAt = new Date();
      milestone.managerReview = {
        reviewedBy: new mongoose.Types.ObjectId(actorUserId),
        reviewedAt: new Date(),
        approvalStatus: "needs_action",
        performanceRating: payload.managerRating || milestone.managerRating || 3,
        feedback: feedback || milestone.managerFeedback || "Revision requested.",
      };
    }

    await milestone.save();

    // Dual notifications on status change
    try {
      if (newStatus === "approved" || newStatus === "completed") {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: milestone.employeeId,
          type: "milestone_approved",
          title: `Day ${milestone.targetDay} Milestone Approved!`,
          message: `Congratulations! Your Day ${milestone.targetDay} milestone "${milestone.milestoneTitle}" has been signed off and approved.`,
          priority: "high",
          data: {
            milestoneId: milestone._id.toString(),
            targetDay: milestone.targetDay,
            status: "approved",
            deepLink: "/milestones",
          },
        });
        if (managerId && managerId.toString() !== actorUserId.toString()) {
          await notificationService.createNotification({
            organizationId: orgId,
            recipientUserId: managerId,
            type: "milestone_approved",
            title: `Milestone Sign-Off: ${employeeName}`,
            message: `Day ${milestone.targetDay} milestone for ${employeeName} has been approved.`,
            priority: "medium",
            data: {
              milestoneId: milestone._id.toString(),
              employeeId: targetEmpId,
              targetDay: milestone.targetDay,
              status: "approved",
              deepLink: "/milestones/team",
            },
          });
        }
      } else if (newStatus === "revision_requested") {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientUserId: milestone.employeeId,
          type: "milestone_revision_requested",
          title: `Revision Requested: Day ${milestone.targetDay} Milestone`,
          message: `Your manager requested revisions on your Day ${milestone.targetDay} milestone: "${feedback || "Please review feedback and update goals."}"`,
          priority: "high",
          data: {
            milestoneId: milestone._id.toString(),
            targetDay: milestone.targetDay,
            status: "revision_requested",
            deepLink: "/milestones",
          },
        });
      }
    } catch (notifErr) {
      console.warn("[MilestoneService] Status update notification error:", notifErr);
    }

    return milestone;
  }

  /**
   * Toggle or update milestone goal checklist items
   */
  async updateMilestoneGoals(
    orgId: string | mongoose.Types.ObjectId,
    milestoneId: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId,
    role: string,
    goalsProgress: Array<{ goalTitle: string; completed: boolean }>
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

    const targetEmpId = milestone.employeeId.toString();
    const isOwnerOrAdmin = ["owner", "admin", "hr_admin", "super_admin"].includes(role);

    if (role === "employee" && targetEmpId !== userId.toString()) {
      throw new AppError(403, "FORBIDDEN", "You can only update your own milestone goals");
    }

    const updateMap = new Map(goalsProgress.map((g) => [g.goalTitle, g.completed]));
    milestone.goalsProgress.forEach((g) => {
      if (updateMap.has(g.goalTitle)) {
        const nextCompleted = updateMap.get(g.goalTitle)!;
        g.completed = nextCompleted;
        if (nextCompleted && !g.completedAt) {
          g.completedAt = new Date();
        } else if (!nextCompleted) {
          g.completedAt = undefined;
        }
      }
    });

    await milestone.save();
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

  /**
   * Autonomous Milestone Evaluation & Escalation Ladder Scanner (Prompt 06 Step 1)
   * Scans pending milestone reviews and executes:
   * - Day 3: Level 1 gentle reminder
   * - Day 5: Level 2 urgent 48h warning
   * - Day 7: Autonomous threshold approval (if eligible) or Skip-Level/HR escalation (if low score/blockers)
   */
  async scanPendingMilestoneReviews(orgId?: string | mongoose.Types.ObjectId) {
    const filter: any = {
      status: "pending_manager_review",
      isDeleted: false,
    };
    if (orgId) {
      filter.organizationId = new mongoose.Types.ObjectId(orgId);
    }

    const pendingMilestones = await EmployeeMilestone.find(filter);
    const now = new Date();
    const results = {
      remindedLevel1: 0,
      remindedLevel2: 0,
      autoApproved: 0,
      escalated: 0,
    };

    for (const milestone of pendingMilestones) {
      const submittedAt = milestone.submittedAt || milestone.createdAt;
      const daysElapsed = (now.getTime() - new Date(submittedAt).getTime()) / (24 * 60 * 60 * 1000);
      const reviewDeadline =
        milestone.sla?.reviewDeadline ||
        new Date(new Date(submittedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
      const isBreached = now.getTime() >= reviewDeadline.getTime() || daysElapsed >= 7;

      const employee = await User.findById(milestone.employeeId);
      const managerId =
        employee?.employment?.managerId || (employee?.employment as any)?.managerUserId;

      // Skip already processed milestones (already escalated or auto-approved)
      if (
        milestone.sla?.escalationState === "auto_approved" ||
        milestone.sla?.escalationState === "escalated"
      ) {
        continue;
      }

      if (isBreached) {
        // =========================================================================
        // DAY 7 POST-SUBMISSION: SLA BREACH WINDOW
        // =========================================================================
        if (milestone.sla?.autoApprovalEligible) {
          // Autonomous Threshold-Based Approval (High Confidence >=4/5, 0 Blockers)
          milestone.status = "approved";
          milestone.managerRating = 4;
          milestone.managerFeedback =
            "Autonomous Milestone Approval: Auto-approved following 7-day manager SLA window without dissent. Employee self-rating was high (>=4/5).";
          milestone.approvedBy = "system.autonomous.sentinel";
          milestone.evaluatedAt = now;
          milestone.managerReview = {
            reviewedBy: undefined,
            reviewedAt: now,
            approvalStatus: "approved",
            performanceRating: 4,
            feedback: milestone.managerFeedback,
          };
          if (milestone.sla) {
            milestone.sla.escalationState = "auto_approved";
          }
          await milestone.save();

          // Emit milestone completion event to unlock downstream roadmap and gamification
          try {
            await eventBus.publish({
              eventName: "MILESTONE_COMPLETED",
              organizationId: milestone.organizationId,
              actorId: undefined,
              entityId: milestone._id as any,
              payload: {
                milestoneId: milestone._id.toString(),
                templateId: milestone.templateId.toString(),
                milestoneTitle: milestone.milestoneTitle,
                employeeId: milestone.employeeId.toString(),
                targetDay: milestone.targetDay,
                autoApproved: true,
                approvedBy: "system.autonomous.sentinel",
              },
            });

            await eventBus.publish({
              eventName: "milestone.auto_approved" as any,
              organizationId: milestone.organizationId,
              actorId: undefined,
              entityId: milestone._id as any,
              payload: {
                milestoneId: milestone._id.toString(),
                employeeId: milestone.employeeId.toString(),
                targetDay: milestone.targetDay,
                approvedBy: "system.autonomous.sentinel",
              },
            });
          } catch (e) {
            console.error("[MilestoneService] Failed to publish auto-approval events:", e);
          }

          // Notify Manager and Employee
          if (managerId) {
            await notificationService.createNotification({
              organizationId: milestone.organizationId,
              recipientUserId: managerId,
              type: "journey_completed",
              title: `Day ${milestone.targetDay} Milestone Auto-Approved`,
              message: `Milestone for ${employee?.profile?.firstName || "Employee"} was autonomously approved following the 7-day manager SLA window without dissent.`,
              priority: "medium",
              data: {
                milestoneId: milestone._id.toString(),
                autoApproved: true,
              },
            });
          }

          await notificationService.createNotification({
            organizationId: milestone.organizationId,
            recipientUserId: milestone.employeeId,
            type: "journey_completed",
            title: `Day ${milestone.targetDay} Milestone Approved!`,
            message: `Your Day ${milestone.targetDay} milestone has been autonomously approved following review SLA expiration.`,
            priority: "high",
            data: {
              milestoneId: milestone._id.toString(),
              targetDay: milestone.targetDay,
              status: "approved",
            },
          });

          results.autoApproved++;
        } else {
          // Low-Rating Guardrail or Blockers: Escalate directly to Skip-Level Manager or HR Ops
          let skipLevelManagerId: any = undefined;
          if (managerId) {
            const managerUser = await User.findById(managerId);
            skipLevelManagerId =
              managerUser?.employment?.managerId ||
              (managerUser?.employment as any)?.managerUserId;
          }

          // Find organization HR Admin if no skip-level exists
          let escalationTargetId = skipLevelManagerId;
          if (!escalationTargetId) {
            const hrAdmin = await User.findOne({
              organizationId: milestone.organizationId,
              "permissions.role": { $in: ["admin", "owner"] },
              isDeleted: false,
            });
            escalationTargetId = hrAdmin?._id;
          }

          if (milestone.sla) {
            milestone.sla.escalationState = "escalated";
            milestone.sla.delegatedToUserId = escalationTargetId;
          }
          await milestone.save();

          if (escalationTargetId) {
            await notificationService.createNotification({
              organizationId: milestone.organizationId,
              recipientUserId: escalationTargetId,
              type: "manager_alert",
              channel: "in_app",
              title: "Milestone Review Escalation Alert",
              message: `Milestone review for ${employee?.profile?.firstName || "Employee"} (Day ${milestone.targetDay}) breached the 7-day manager SLA. Auto-approval was blocked (Self-rating: ${milestone.employeeRating || "N/A"}/5, Blockers: ${milestone.sla?.blockersReported ? "Yes" : "None"}). Mandatory human review is required.`,
              priority: "critical",
              data: {
                milestoneId: milestone._id.toString(),
                employeeId: milestone.employeeId.toString(),
                escalated: true,
              },
            });
          }

          results.escalated++;
        }
      } else if (daysElapsed >= 5 && (milestone.sla?.reminderSentCount ?? 0) < 2) {
        // =========================================================================
        // DAY 5 POST-SUBMISSION: LEVEL 2 URGENT 48-HOUR ALERT
        // =========================================================================
        if (managerId) {
          await notificationService.createNotification({
            organizationId: milestone.organizationId,
            recipientUserId: managerId,
            type: "manager_alert",
            channel: "in_app",
            title: "Action Required: Milestone Review Overdue in 48 Hours",
            message: `Action Required: Day ${milestone.targetDay} milestone evaluation for ${employee?.profile?.firstName || "Employee"} is awaiting review and will breach SLA in 48 hours.`,
            priority: "high",
            data: {
              milestoneId: milestone._id.toString(),
              reviewDeadline: reviewDeadline.toISOString(),
              level: 2,
            },
          });
        }
        if (milestone.sla) {
          milestone.sla.reminderSentCount = 2;
          milestone.sla.lastReminderSentAt = now;
          milestone.sla.escalationState = "reminded";
        }
        await milestone.save();
        results.remindedLevel2++;
      } else if (daysElapsed >= 3 && (milestone.sla?.reminderSentCount ?? 0) < 1) {
        // =========================================================================
        // DAY 3 POST-SUBMISSION: LEVEL 1 FRIENDLY REMINDER
        // =========================================================================
        if (managerId) {
          await notificationService.createNotification({
            organizationId: milestone.organizationId,
            recipientUserId: managerId,
            type: "journey_due_soon",
            channel: "in_app",
            title: `Friendly Reminder: Day ${milestone.targetDay} Review Awaiting Sign-Off`,
            message: `Friendly reminder: ${employee?.profile?.firstName || "Employee"}'s Day ${milestone.targetDay} evaluation is awaiting review.`,
            priority: "medium",
            data: {
              milestoneId: milestone._id.toString(),
              reviewDeadline: reviewDeadline.toISOString(),
              level: 1,
            },
          });
        }
        if (milestone.sla) {
          milestone.sla.reminderSentCount = 1;
          milestone.sla.lastReminderSentAt = now;
          milestone.sla.escalationState = "reminded";
        }
        await milestone.save();
        results.remindedLevel1++;
      }
    }

    return results;
  }
}

export const milestoneService = new MilestoneService();
export default milestoneService;
