import crypto from "crypto";
import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import OnboardingCase, { IOnboardingCase, OnboardingCaseSource, OnboardingCaseState } from "../models/onboarding-case.model.js";
import OutboxEvent from "../models/outbox-event.model.js";
import User from "../../auth/models/user.model.js";
import Journey from "../../journeys/models/journey.model.js";
import AuditLog from "../../audit-logs/models/audit-log.model.js";
import OnboardingHealth from "../../analytics/models/onboarding-health.model.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import AssignmentService from "../../assignments/services/assignment.service.js";
import AssignmentRepository from "../../assignments/repositories/assignment.repository.js";
import { eventBus } from "../../../infrastructure/events/event-bus.js";

const transitions: Record<OnboardingCaseState, OnboardingCaseState[]> = {
  created: ["resolving", "cancelled"],
  resolving: ["provisioning", "provisioning_failed", "cancelled"],
  provisioning: ["ready", "provisioning_failed", "cancelled"],
  provisioning_failed: ["provisioning", "cancelled"],
  ready: ["active", "cancelled"],
  active: ["paused", "ready_for_handover", "cancelled"],
  paused: ["active", "provisioning", "cancelled"],
  ready_for_handover: ["handover_pending", "completed", "paused", "cancelled"],
  handover_pending: ["completed", "paused", "cancelled"],
  completed: ["archived", "cancelled"],
  archived: [],
  cancelled: [],
};

export interface IExceptionFilter {
  state?: string;
  severity?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IResolutionPayload {
  action: "retry" | "override_journey" | "force_activate" | "cancel";
  targetTemplateId?: string;
  reason: string;
  employmentUpdates?: {
    department?: string;
    jobTitle?: string;
    managerId?: string;
  };
}

export class OnboardingCaseService {
  private notificationService: NotificationService;
  private assignmentService: AssignmentService;

  constructor(notificationService?: NotificationService, assignmentService?: AssignmentService) {
    this.notificationService =
      notificationService || new NotificationService(new NotificationRepository());
    this.assignmentService =
      assignmentService || new AssignmentService(new AssignmentRepository());
  }

  async createCase(input: {
    organizationId: string;
    employeeId: string;
    source: OnboardingCaseSource;
    idempotencyKey: string;
    createdBy?: string;
    correlationId?: string;
  }): Promise<{ case: IOnboardingCase; created: boolean }> {
    const organizationId = new mongoose.Types.ObjectId(input.organizationId);
    const employeeId = new mongoose.Types.ObjectId(input.employeeId);
    const existing = await OnboardingCase.findOne({
      organizationId,
      idempotencyKey: input.idempotencyKey,
      isDeleted: false,
    });
    if (existing) return { case: existing, created: false };

    const correlationId = input.correlationId || crypto.randomUUID();
    try {
      const created = await OnboardingCase.create({
        organizationId,
        employeeId,
        source: input.source,
        idempotencyKey: input.idempotencyKey,
        state: "created",
        transitions: [
          {
            from: null,
            to: "created",
            at: new Date(),
            actorUserId: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
          },
        ],
        createdBy: input.createdBy ? new mongoose.Types.ObjectId(input.createdBy) : undefined,
        isDeleted: false,
      });
      await OutboxEvent.create({
        organizationId,
        aggregateType: "onboarding_case",
        aggregateId: created._id,
        eventName: "onboarding.case.created",
        correlationId,
        payload: {
          caseId: created._id.toString(),
          employeeId: employeeId.toString(),
          source: input.source,
        },
      });
      return { case: created, created: true };
    } catch (error: any) {
      if (error?.code === 11000) {
        const duplicate = await OnboardingCase.findOne({
          organizationId,
          idempotencyKey: input.idempotencyKey,
          isDeleted: false,
        });
        if (duplicate) return { case: duplicate, created: false };
      }
      throw error;
    }
  }

  async transition(
    caseId: string,
    organizationId: string,
    to: OnboardingCaseState,
    actorUserId?: string,
    reason?: string
  ) {
    const record = await OnboardingCase.findOne({ _id: caseId, organizationId, isDeleted: false });
    if (!record) throw new AppError(404, "NOT_FOUND", "Onboarding case not found");
    if (!transitions[record.state].includes(to)) {
      throw new AppError(
        409,
        "INVALID_STATE_TRANSITION",
        `Cannot transition onboarding case from ${record.state} to ${to}`
      );
    }
    const from = record.state;
    record.state = to;
    record.stateReason = reason;
    record.transitions.push({
      from,
      to,
      at: new Date(),
      actorUserId: actorUserId ? new mongoose.Types.ObjectId(actorUserId) : undefined,
      reason,
    });
    await record.save();
    await OutboxEvent.create({
      organizationId: record.organizationId,
      aggregateType: "onboarding_case",
      aggregateId: record._id,
      eventName: `onboarding.case.${to}`,
      correlationId: crypto.randomUUID(),
      payload: { caseId: record._id.toString(), from, to, reason },
    });
    return record;
  }

  async cancelCaseForEmployee(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    reason = "hris_termination_event",
    actorUserId?: string
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
    const empObjectId = new mongoose.Types.ObjectId(employeeId.toString());

    const record = await OnboardingCase.findOne({
      organizationId: orgObjectId,
      employeeId: empObjectId,
      isDeleted: false,
    });

    if (!record) return null;
    if (record.state === "cancelled") return record;

    const from = record.state;
    record.state = "cancelled";
    record.stateReason = reason;
    record.transitions.push({
      from,
      to: "cancelled",
      at: new Date(),
      actorUserId: actorUserId ? new mongoose.Types.ObjectId(actorUserId) : undefined,
      reason,
    });
    await record.save();

    await OutboxEvent.create({
      organizationId: record.organizationId,
      aggregateType: "onboarding_case",
      aggregateId: record._id,
      eventName: "onboarding.case.cancelled",
      correlationId: crypto.randomUUID(),
      payload: { caseId: record._id.toString(), from, to: "cancelled", reason, employeeId: empObjectId.toString() },
    });

    return record;
  }

  /**
   * Retrieves quarantined / exception onboarding cases for the HR Ops Exception Workbench.
   */
  async getExceptionCases(
    organizationId: string | mongoose.Types.ObjectId,
    filter?: IExceptionFilter
  ) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
    const page = Math.max(1, filter?.page || 1);
    const limit = Math.min(100, Math.max(1, filter?.limit || 20));
    const skip = (page - 1) * limit;

    const query: any = {
      organizationId: orgObjectId,
      isDeleted: false,
    };

    if (filter?.state && filter.state !== "all") {
      query.state = filter.state;
    } else {
      query.state = { $in: ["paused", "provisioning_failed", "handover_pending"] };
    }

    const total = await OnboardingCase.countDocuments(query);
    const rawCases = await OnboardingCase.find(query)
      .populate({
        path: "employeeId",
        select: "profile employment auth createdAt",
      })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const now = Date.now();
    const cases = rawCases.map((c: any) => {
      const emp = c.employeeId;
      const lastTransition =
        c.transitions && c.transitions.length > 0
          ? c.transitions[c.transitions.length - 1]
          : null;
      const quarantinedAt = lastTransition?.at || c.updatedAt || c.createdAt;
      const daysQuarantined = Math.max(
        0,
        Math.floor((now - new Date(quarantinedAt).getTime()) / (1000 * 60 * 60 * 24))
      );

      let severity: "critical" | "high" | "medium" = "medium";
      if (c.state === "provisioning_failed" || daysQuarantined >= 7) {
        severity = "critical";
      } else if (daysQuarantined >= 3 || (c.state === "paused" && !!c.failure)) {
        severity = "high";
      }

      return {
        _id: c._id.toString(),
        state: c.state,
        stateReason: c.stateReason || lastTransition?.reason || "Awaiting manual triage",
        source: c.source,
        idempotencyKey: c.idempotencyKey,
        quarantinedAt,
        daysQuarantined,
        severity,
        failure: c.failure,
        resolvedPlan: c.resolvedPlan,
        transitions: c.transitions,
        employee: emp
          ? {
              _id: emp._id.toString(),
              name:
                emp.profile?.fullName ||
                `${emp.profile?.firstName || ""} ${emp.profile?.lastName || ""}`.trim() ||
                "Unknown Employee",
              email: emp.auth?.email,
              department: emp.employment?.department || "Unassigned",
              jobTitle: emp.employment?.jobTitle || "Unassigned",
              status: emp.employment?.status,
              managerId: emp.employment?.managerId,
              hireDate: emp.employment?.hireDate,
            }
          : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return {
      cases,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Resolves an onboarding case exception with structured audit logging and re-anchoring.
   */
  async resolveException(
    caseId: string,
    organizationId: string | mongoose.Types.ObjectId,
    actorUserId: string | mongoose.Types.ObjectId,
    resolution: IResolutionPayload,
    reqMeta?: { ipAddress?: string; userAgent?: string }
  ) {
    // 1. Regulatory & SOC 2 Mandatory Reason Validation (minimum 10 characters)
    if (!resolution.reason || resolution.reason.trim().length < 10) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "A detailed resolution reason of at least 10 characters is mandatory for audit compliance."
      );
    }

    const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
    const actorObjectId = new mongoose.Types.ObjectId(actorUserId.toString());

    const onboardingCase = await OnboardingCase.findOne({
      _id: caseId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!onboardingCase) {
      throw new AppError(404, "NOT_FOUND", "Onboarding case not found");
    }

    const employee = await User.findOne({
      _id: onboardingCase.employeeId,
      organizationId: orgObjectId,
      isDeleted: false,
    });

    if (!employee) {
      throw new AppError(404, "NOT_FOUND", "Target employee record not found");
    }

    // Apply optional metadata corrections inline if provided
    if (resolution.employmentUpdates) {
      if (resolution.employmentUpdates.department) {
        employee.employment.department = resolution.employmentUpdates.department;
      }
      if (resolution.employmentUpdates.jobTitle) {
        employee.employment.jobTitle = resolution.employmentUpdates.jobTitle;
      }
      if (resolution.employmentUpdates.managerId) {
        employee.employment.managerId = new mongoose.Types.ObjectId(
          resolution.employmentUpdates.managerId
        );
      }
      await employee.save();
    }

    const previousState = onboardingCase.state;
    const now = new Date();

    if (resolution.action === "override_journey") {
      if (!resolution.targetTemplateId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "targetTemplateId is required when overriding a journey."
        );
      }

      const targetJourney = await Journey.findOne({
        _id: resolution.targetTemplateId,
        organizationId: orgObjectId,
        isDeleted: false,
      });

      if (!targetJourney) {
        throw new AppError(404, "NOT_FOUND", "Selected journey template does not exist");
      }

      // Ensure journey is published so it can be assigned
      if (targetJourney.publishing.status !== "published") {
        targetJourney.publishing.status = "published";
        await targetJourney.save();
      }

      // Update resolvedPlan metadata
      onboardingCase.resolvedPlan = {
        planId: targetJourney._id.toString(),
        version: targetJourney.publishing?.version || 1,
        resolvedAt: now,
        reason: resolution.reason,
      };
      onboardingCase.failure = undefined;
      onboardingCase.state = "active";
      onboardingCase.stateReason = resolution.reason;
      onboardingCase.transitions.push({
        from: previousState,
        to: "active",
        at: now,
        actorUserId: actorObjectId,
        reason: resolution.reason,
      });
      await onboardingCase.save();

      // Assign the new Journey Template (Non-destructive: existing signed docs remain untouched)
      await this.assignmentService.assignJourney(
        orgObjectId,
        employee._id,
        targetJourney._id,
        actorObjectId,
        {
          source: "manual",
          priority: "normal",
        }
      );

      // Re-anchor employee onboarding state
      employee.employment.status = "onboarding";
      employee.employment.onboardingState = "active";
      employee.employment.onboardingStateReason = resolution.reason;
      await employee.save();

      // Reset Velocity Sentinel baseline to avoid false alerts
      await OnboardingHealth.updateOne(
        { organizationId: orgObjectId, employeeId: employee._id },
        {
          $set: {
            lastActiveAt: now,
            calculatedAt: now,
            nudgeLevel: 0,
            riskLevel: "on_track",
            dropOffRiskScore: 0.0,
          },
          $unset: {
            suppressedReason: "",
          },
        }
      );

      // Outbox and EventMesh emission
      await OutboxEvent.create({
        organizationId: orgObjectId,
        aggregateType: "onboarding_case",
        aggregateId: onboardingCase._id,
        eventName: "onboarding.case.overridden",
        correlationId: crypto.randomUUID(),
        payload: {
          caseId: onboardingCase._id.toString(),
          employeeId: employee._id.toString(),
          targetTemplateId: targetJourney._id.toString(),
          reason: resolution.reason,
          actorUserId: actorUserId.toString(),
        },
      });

      await eventBus.publish("ONBOARDING_CASE_STATE_CHANGED", {
        organizationId: orgObjectId.toString(),
        actorId: actorUserId.toString(),
        entityId: onboardingCase._id.toString(),
        payload: {
          caseId: onboardingCase._id.toString(),
          action: "override_journey",
          from: previousState,
          to: "active",
          targetTemplateId: targetJourney._id.toString(),
          reason: resolution.reason,
        },
      });

      // Manager notification
      if (employee.employment.managerId) {
        await this.notificationService.createNotification({
          organizationId: orgObjectId,
          recipientUserId: employee.employment.managerId,
          type: "manager_alert",
          title: `Onboarding Plan Updated: ${employee.profile.fullName}`,
          message: `HR Ops updated ${employee.profile.fullName}'s onboarding journey to "${targetJourney.title}". Reason: ${resolution.reason}`,
          priority: "medium",
        });
      }
    } else if (resolution.action === "retry") {
      onboardingCase.failure = undefined;
      onboardingCase.state = "provisioning";
      onboardingCase.stateReason = resolution.reason;
      onboardingCase.transitions.push({
        from: previousState,
        to: "provisioning",
        at: now,
        actorUserId: actorObjectId,
        reason: resolution.reason,
      });
      await onboardingCase.save();

      await OutboxEvent.create({
        organizationId: orgObjectId,
        aggregateType: "onboarding_case",
        aggregateId: onboardingCase._id,
        eventName: "onboarding.case.retried",
        correlationId: crypto.randomUUID(),
        payload: {
          caseId: onboardingCase._id.toString(),
          employeeId: employee._id.toString(),
          reason: resolution.reason,
        },
      });
    } else if (resolution.action === "force_activate") {
      onboardingCase.state = "active";
      onboardingCase.stateReason = resolution.reason;
      onboardingCase.failure = undefined;
      onboardingCase.transitions.push({
        from: previousState,
        to: "active",
        at: now,
        actorUserId: actorObjectId,
        reason: resolution.reason,
      });
      await onboardingCase.save();

      employee.employment.status = "onboarding";
      employee.employment.onboardingState = "active";
      employee.employment.onboardingStateReason = resolution.reason;
      await employee.save();

      // Reset Velocity Sentinel baseline
      await OnboardingHealth.updateOne(
        { organizationId: orgObjectId, employeeId: employee._id },
        {
          $set: {
            lastActiveAt: now,
            calculatedAt: now,
            nudgeLevel: 0,
            riskLevel: "on_track",
            dropOffRiskScore: 0.0,
          },
          $unset: {
            suppressedReason: "",
          },
        }
      );
    } else if (resolution.action === "cancel") {
      onboardingCase.state = "cancelled";
      onboardingCase.stateReason = resolution.reason;
      onboardingCase.transitions.push({
        from: previousState,
        to: "cancelled",
        at: now,
        actorUserId: actorObjectId,
        reason: resolution.reason,
      });
      await onboardingCase.save();

      employee.employment.onboardingState = "archived";
      employee.employment.onboardingStateReason = resolution.reason;
      await employee.save();
    } else {
      throw new AppError(400, "BAD_REQUEST", `Unsupported resolution action: ${resolution.action}`);
    }

    // Immutable Audit Log Record
    await AuditLog.create({
      organizationId: orgObjectId,
      actorUserId: actorObjectId,
      actorType: "user",
      eventCategory: "journey",
      eventType: "ONBOARDING_CASE_MANUALLY_RESOLVED",
      resourceType: "onboarding_case",
      resourceId: onboardingCase._id,
      action: "update",
      description: `Manual override executed: ${resolution.action}. Reason: ${resolution.reason}`,
      metadata: {
        resolutionAction: resolution.action,
        previousState,
        newState: onboardingCase.state,
        reason: resolution.reason,
        targetTemplateId: resolution.targetTemplateId,
        employeeId: employee._id.toString(),
      },
      request: {
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      },
      severity: "warning",
    });

    return {
      success: true,
      case: onboardingCase,
      message: `Onboarding case successfully resolved via ${resolution.action}.`,
    };
  }
}

export const onboardingCaseService = new OnboardingCaseService();
export default onboardingCaseService;
