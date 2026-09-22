import mongoose from "mongoose";
import WorkflowRepository from "../repositories/workflow.repository.js";
import WorkflowRule, { IWorkflowCondition, IWorkflowAction, IWorkflowRule } from "../models/workflow-rule.model.js";
import WorkflowExecutionLog from "../models/workflow-execution.model.js";
import User from "../../auth/models/user.model.js";
import Journey from "../../journeys/models/journey.model.js";
import EmployeeAssignmentService from "../../assignments/services/assignment.service.js";
import AssignmentRepository from "../../assignments/repositories/assignment.repository.js";
import TaskService from "../../tasks/services/task.service.js";
import TaskRepository from "../../tasks/repositories/task.repository.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";
import documentService from "../../documents/services/document.service.js";
import buddyService from "../../buddy/services/buddy.service.js";
import smartAssignmentService from "../../journeys/services/smart-assignment.service.js";
import onboardingCaseService from "../../onboarding/services/onboarding-case.service.js";
import queueService from "../../../infrastructure/queue/queue.service.js";
import milestoneService from "../../milestones/services/milestone.service.js";
import roleChecklistService from "../../tasks/services/role-checklist.service.js";

const assignmentService = new EmployeeAssignmentService(new AssignmentRepository());
const taskService = new TaskService(new TaskRepository());
const notificationService = new NotificationService(new NotificationRepository());

export interface ResolvedWorkflowCandidate {
  _id: string | mongoose.Types.ObjectId;
  name: string;
  priorityIndex: number;
  specificityScore: number;
  updatedAt: Date;
  actions: IWorkflowAction[];
  createdBy: any;
  sourceType: "custom_rule" | "journey_audience";
  journeyId?: string | mongoose.Types.ObjectId;
  ruleDoc?: any;
}

export class WorkflowEngine {
  private repository: WorkflowRepository;

  constructor() {
    this.repository = new WorkflowRepository();
  }

  /**
   * Evaluate and execute active rules matching a domain trigger event
   */
  async processEvent(
    organizationId: string | mongoose.Types.ObjectId,
    triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due" | "milestone_completed",
    targetUserId: string | mongoose.Types.ObjectId,
    eventPayload: any = {}
  ): Promise<number> {
    const targetUser = await User.findOne({
      _id: targetUserId,
      organizationId,
      isDeleted: false,
    });
    if (!targetUser) {
      console.warn(`[WorkflowEngine] Target user ${targetUserId} not found for org ${organizationId}`);
      return 0;
    }

    const matchedRules: ResolvedWorkflowCandidate[] = [];

    // 1. Discover Custom Admin Rules
    const customRules = await this.repository.findRules(organizationId, triggerType, true);
    for (const rule of customRules) {
      const conditionsMatch = this.evaluateConditions(rule.conditions, targetUser, eventPayload);
      if (conditionsMatch) {
        matchedRules.push({
          _id: rule._id,
          name: rule.name,
          priorityIndex: rule.priority ?? 0,
          specificityScore: rule.conditions?.length || 0,
          updatedAt: rule.updatedAt || rule.createdAt || new Date(0),
          actions: [...rule.actions],
          createdBy: rule.createdBy,
          sourceType: "custom_rule",
          ruleDoc: rule,
        });
      }
    }

    // 2. Discover Journey Audience Rules (for user_created) as Virtual System Rules (Base Priority 50)
    if (triggerType === "user_created") {
      const audienceJourneys = await Journey.find({
        organizationId,
        "publishing.status": "published",
        "audience.autoEnrollNewHires": true,
        isDeleted: false,
      });

      for (const journey of audienceJourneys) {
        const matchingUsers = await smartAssignmentService.findMatchingEmployees(
          organizationId,
          journey.audience
        );
        const isMatch = matchingUsers.some((u) => u._id.toString() === targetUserId.toString());
        if (isMatch) {
          let specificity = 0;
          if (journey.audience?.departmentNames?.length || journey.audience?.departments?.length) specificity++;
          if (journey.audience?.jobTitleNames?.length || journey.audience?.jobTitles?.length) specificity++;
          if (journey.audience?.locations?.length) specificity++;
          if (journey.audience?.employmentTypes?.length) specificity++;

          matchedRules.push({
            _id: journey._id,
            name: `Audience Auto-Enroll: ${journey.title}`,
            priorityIndex: 50,
            specificityScore: specificity,
            updatedAt: journey.updatedAt || journey.createdAt || new Date(0),
            actions: [
              {
                type: "assign_journey",
                params: {
                  journeyId: journey._id.toString(),
                  delayMinutes: 0,
                },
              },
            ],
            createdBy: journey.createdBy,
            sourceType: "journey_audience",
            journeyId: journey._id,
            ruleDoc: journey,
          });
        }
      }
    }

    // 3. Deterministic Arbitration Protocol (Resolving UQ-06)
    matchedRules.sort((a, b) => {
      // 1. priorityIndex DESC (highest priority evaluates first)
      if (b.priorityIndex !== a.priorityIndex) {
        return b.priorityIndex - a.priorityIndex;
      }
      // 2. Specificity Score DESC (department + role + location beats department alone)
      if (b.specificityScore !== a.specificityScore) {
        return b.specificityScore - a.specificityScore;
      }
      // 3. updatedAt DESC (most recently modified administrative rule wins)
      const timeDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      if (timeDiff !== 0) {
        return timeDiff;
      }
      // 4. _id ASC (guaranteed deterministic tie-breaker)
      return String(a._id).localeCompare(String(b._id));
    });

    // 4. Contradictory Assignment Arbitration (Single Journey Assignment)
    const journeyAssigningRules = matchedRules.filter((r) =>
      r.actions.some((a) => a.type === "assign_journey")
    );

    if (journeyAssigningRules.length > 1) {
      const winningCandidate = journeyAssigningRules[0];
      const suppressedCandidates = journeyAssigningRules.slice(1);

      // Remove assign_journey action from all subordinate rules
      for (const suppressed of suppressedCandidates) {
        suppressed.actions = suppressed.actions.filter((a) => a.type !== "assign_journey");
      }

      // Record WORKFLOW_RULE_CONFLICT_ARBITRATED in AuditLog
      try {
        const AuditLog = mongoose.model("AuditLog");
        await AuditLog.create({
          organizationId: new mongoose.Types.ObjectId(organizationId),
          actorUserId: targetUser._id,
          actorType: "system",
          eventCategory: "system",
          eventType: "WORKFLOW_RULE_CONFLICT_ARBITRATED",
          resourceType: "workflow_rule",
          resourceId: mongoose.Types.ObjectId.isValid(winningCandidate._id)
            ? new mongoose.Types.ObjectId(winningCandidate._id)
            : undefined,
          action: "assign",
          description: `Deterministic arbitration selected rule "${winningCandidate.name}" (priority: ${winningCandidate.priorityIndex}, specificity: ${winningCandidate.specificityScore}) over suppressed rule(s): ${suppressedCandidates.map((r) => `"${r.name}"`).join(", ")}`,
          metadata: {
            winningRuleId: winningCandidate._id.toString(),
            winningRuleName: winningCandidate.name,
            suppressedRuleIds: suppressedCandidates.map((r) => r._id.toString()),
            reason: "priority_and_specificity_precedence",
          },
          severity: "info",
        });
      } catch (auditErr) {
        console.warn("[WorkflowEngine] Could not log arbitration audit entry:", auditErr);
      }
    }

    // 5. Default Fallback (BR-WFK-003): If zero rules assign a journey, assign workspace default
    let executedCount = 0;
    let anyJourneyAssigned = matchedRules.some((r) =>
      r.actions.some((a) => a.type === "assign_journey")
    );

    if (triggerType === "user_created" && !anyJourneyAssigned) {
      const defaultJourney = await Journey.findOne({
        organizationId,
        isDefault: true,
        "publishing.status": "published",
        isDeleted: false,
      });

      if (defaultJourney) {
        try {
          await assignmentService.assignJourney(
            organizationId,
            targetUser._id,
            defaultJourney._id,
            defaultJourney.createdBy,
            {
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              source: "workflow_engine",
            }
          );
          anyJourneyAssigned = true;
          executedCount++;
        } catch (err: any) {
          // Ignored if already assigned
        }
      }
    }

    // 6. Execute Action Pipeline for Matched Rules
    for (const rule of matchedRules) {
      if (rule.actions.length === 0) {
        continue;
      }

      executedCount++;
      const stepResults: any[] = [];
      let overallStatus: "success" | "partial_failure" | "failed" | "paused_delay" = "success";
      let errorMsg: string | undefined = undefined;
      let isDelayed = false;

      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];
        const stepIndex = i + 1;

        if (action.type === "delay") {
          const delayMinutes = action.params?.delayMinutes || 0;
          const resumeAt = new Date(Date.now() + delayMinutes * 60 * 1000);

          stepResults.push({
            stepIndex,
            actionType: "delay",
            status: "delayed",
            resultMessage: `Execution step delayed by ${delayMinutes} minutes until ${resumeAt.toISOString()}`,
            executedAt: new Date(),
          });

          // Save WorkflowExecutionLog with paused_delay
          const executionLog = await this.repository.createExecutionLog({
            organizationId: new mongoose.Types.ObjectId(organizationId),
            workflowRuleId: mongoose.Types.ObjectId.isValid(rule._id)
              ? new mongoose.Types.ObjectId(rule._id)
              : new mongoose.Types.ObjectId(),
            triggerEvent: triggerType,
            targetUserId: new mongoose.Types.ObjectId(targetUserId),
            status: "paused_delay",
            conditionsEvaluated: true,
            stepResults,
            nextStepIndex: i + 2, // 1-indexed next step to execute
            resumeAt,
            executedAt: new Date(),
          });

          // Enqueue scheduled resumption job in persistent queue
          await queueService.enqueue(
            "resume_delayed_workflow",
            {
              executionId: executionLog._id.toString(),
              organizationId: organizationId.toString(),
              resumeAt,
            },
            {
              organizationId,
              delayMs: delayMinutes * 60 * 1000,
              availableAt: resumeAt,
              idempotencyKey: `delayed_wf_${executionLog._id}_${stepIndex}`,
            }
          );

          isDelayed = true;
          break;
        }

        try {
          const res = await this.executeAction(
            action,
            organizationId,
            targetUser,
            rule.createdBy,
            eventPayload
          );
          stepResults.push({
            stepIndex,
            actionType: action.type,
            status: res.status,
            resultMessage: res.message,
            outputData: res.output,
            executedAt: new Date(),
          });
          if (res.status === "failed" && overallStatus !== "failed") {
            overallStatus = "partial_failure";
            errorMsg = res.message;
            console.error("[WorkflowEngine Step Failed]", res.message);

            // If an unresolvable journey conflict occurred, pause the OnboardingCase
            if (action.type === "assign_journey") {
              await this.quarantineOnboardingCase(
                organizationId,
                targetUser._id,
                res.message || "Journey assignment failed"
              );
            }
          }
        } catch (err: any) {
          errorMsg = err.message || "Action step failed";
          console.error("[WorkflowEngine Step Exception]", err);
          stepResults.push({
            stepIndex,
            actionType: action.type,
            status: "failed",
            resultMessage: errorMsg,
            executedAt: new Date(),
          });
          overallStatus = "failed";

          if (action.type === "assign_journey") {
            await this.quarantineOnboardingCase(
              organizationId,
              targetUser._id,
              errorMsg || "Action step failed"
            );
          }
        }
      }

      if (!isDelayed) {
        await this.repository.createExecutionLog({
          organizationId: new mongoose.Types.ObjectId(organizationId),
          workflowRuleId: mongoose.Types.ObjectId.isValid(rule._id)
            ? new mongoose.Types.ObjectId(rule._id)
            : new mongoose.Types.ObjectId(),
          triggerEvent: triggerType,
          targetUserId: new mongoose.Types.ObjectId(targetUserId),
          status: overallStatus,
          conditionsEvaluated: true,
          stepResults,
          errorDetails: errorMsg,
          executedAt: new Date(),
          completedAt: new Date(),
        });
      }
    }

    return executedCount;
  }

  /**
   * Resumes a paused delayed workflow execution
   */
  async resumeDelayedExecution(executionId: string | mongoose.Types.ObjectId): Promise<boolean> {
    const execution = await WorkflowExecutionLog.findById(executionId);
    if (!execution || execution.status !== "paused_delay") {
      return false;
    }

    const rule = await WorkflowRule.findById(execution.workflowRuleId);
    if (!rule) {
      execution.status = "failed";
      execution.errorDetails = "Workflow rule not found during delayed resumption";
      await execution.save();
      return false;
    }

    const targetUser = await User.findById(execution.targetUserId);
    if (!targetUser) {
      execution.status = "failed";
      execution.errorDetails = "Target user not found during delayed resumption";
      await execution.save();
      return false;
    }

    const startIndex = (execution.nextStepIndex || 1) - 1; // 0-based index
    let overallStatus: "success" | "partial_failure" | "failed" | "paused_delay" = "success";
    let errorMsg = execution.errorDetails;
    let isDelayedAgain = false;

    for (let i = startIndex; i < rule.actions.length; i++) {
      const action = rule.actions[i];
      const stepIndex = i + 1;

      if (action.type === "delay") {
        const delayMinutes = action.params?.delayMinutes || 0;
        const resumeAt = new Date(Date.now() + delayMinutes * 60 * 1000);

        execution.stepResults.push({
          stepIndex,
          actionType: "delay",
          status: "delayed",
          resultMessage: `Execution step delayed by ${delayMinutes} minutes until ${resumeAt.toISOString()}`,
          executedAt: new Date(),
        });

        execution.status = "paused_delay";
        execution.nextStepIndex = i + 2;
        execution.resumeAt = resumeAt;
        await execution.save();

        await queueService.enqueue(
          "resume_delayed_workflow",
          {
            executionId: execution._id.toString(),
            organizationId: execution.organizationId.toString(),
            resumeAt,
          },
          {
            organizationId: execution.organizationId,
            delayMs: delayMinutes * 60 * 1000,
            availableAt: resumeAt,
            idempotencyKey: `delayed_wf_${execution._id}_${stepIndex}`,
          }
        );

        isDelayedAgain = true;
        break;
      }

      try {
        const res = await this.executeAction(
          action,
          execution.organizationId,
          targetUser,
          rule.createdBy,
          {}
        );
        execution.stepResults.push({
          stepIndex,
          actionType: action.type,
          status: res.status,
          resultMessage: res.message,
          outputData: res.output,
          executedAt: new Date(),
        });
        if (res.status === "failed" && overallStatus !== "failed") {
          overallStatus = "partial_failure";
          errorMsg = res.message;
        }
      } catch (err: any) {
        errorMsg = err.message || "Action step failed";
        execution.stepResults.push({
          stepIndex,
          actionType: action.type,
          status: "failed",
          resultMessage: errorMsg,
          executedAt: new Date(),
        });
        overallStatus = "failed";
      }
    }

    if (!isDelayedAgain) {
      execution.status = overallStatus;
      execution.completedAt = new Date();
      execution.errorDetails = errorMsg;
      await execution.save();
    }

    return true;
  }

  /**
   * Helper to quarantine an onboarding case to paused status upon unresolvable workflow conflict
   */
  private async quarantineOnboardingCase(
    organizationId: string | mongoose.Types.ObjectId,
    employeeId: string | mongoose.Types.ObjectId,
    reason: string
  ): Promise<void> {
    try {
      const OnboardingCase = mongoose.model("OnboardingCase");
      const caseRecord = await OnboardingCase.findOne({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        employeeId: new mongoose.Types.ObjectId(employeeId),
        isDeleted: false,
      });

      if (caseRecord && caseRecord.state !== "paused") {
        await onboardingCaseService.transition(
          caseRecord._id.toString(),
          organizationId.toString(),
          "paused",
          undefined,
          `rule_conflict: ${reason}`
        );
      }
    } catch (err) {
      console.warn("[WorkflowEngine] Could not quarantine OnboardingCase:", err);
    }
  }

  /**
   * Evaluate rule condition logic against target user profile & employment fields
   */
  public evaluateConditions(conditions: IWorkflowCondition[], targetUser: any, eventPayload: any = {}): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    for (const cond of conditions) {
      let fieldValue: any = undefined;
      if (cond.field === "department") {
        fieldValue = targetUser.employment?.department || targetUser.employment?.departmentId || eventPayload?.department;
      } else if (cond.field === "jobTitle") {
        fieldValue = targetUser.employment?.jobTitle || targetUser.employment?.designation || targetUser.employment?.jobTitleId || eventPayload?.jobTitle;
      } else if (cond.field === "location") {
        fieldValue = targetUser.employment?.location || targetUser.profile?.location || eventPayload?.location;
      } else if (cond.field === "employmentStatus") {
        fieldValue = targetUser.employment?.status || targetUser.employment?.employmentType || eventPayload?.employmentStatus;
      } else if (cond.field === "role") {
        fieldValue = targetUser.permissions?.role || eventPayload?.role;
      }

      const userValStr = String(fieldValue || "").toLowerCase();
      const condValStr = Array.isArray(cond.value)
        ? cond.value.map((v) => String(v).toLowerCase())
        : String(cond.value).toLowerCase();

      let match = false;
      if (cond.operator === "equals") {
        match = userValStr === condValStr;
      } else if (cond.operator === "not_equals") {
        match = userValStr !== condValStr;
      } else if (cond.operator === "contains") {
        match = userValStr.includes(String(condValStr));
      } else if (cond.operator === "in" && Array.isArray(condValStr)) {
        match = condValStr.includes(userValStr);
      }

      if (!match) {
        return false; // All conditions must pass (AND logic)
      }
    }

    return true;
  }

  /**
   * Execute single action step
   */
  private async executeAction(
    action: IWorkflowAction,
    organizationId: string | mongoose.Types.ObjectId,
    targetUser: any,
    authorUserId: mongoose.Types.ObjectId,
    eventPayload: any
  ): Promise<{ status: "success" | "failed" | "skipped" | "delayed"; message: string; output?: any }> {
    const authorIdStr = (authorUserId as any)?._id
      ? (authorUserId as any)._id.toString()
      : authorUserId.toString();

    switch (action.type) {
      case "assign_journey": {
        const journeyId =
          action.params?.journeyId ||
          (action as any).targetTemplateId ||
          (action as any).targetTemplate ||
          (action.params as any)?.targetTemplateId;
        if (!journeyId) {
          return { status: "failed", message: "journeyId parameter missing for assign_journey action" };
        }
        try {
          const journey = await Journey.findOne({
            _id: journeyId,
            organizationId,
            isDeleted: false,
          });
          if (!journey) {
            return { status: "failed", message: `Journey ${journeyId} not found` };
          }

          const assignment = await assignmentService.assignJourney(
            organizationId,
            targetUser._id,
            journeyId,
            authorIdStr,
            {
              dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
              source: "workflow_engine",
            }
          );
          return {
            status: "success",
            message: `Assigned journey "${journey.title}" to ${targetUser.profile?.firstName}`,
            output: assignment,
          };
        } catch (err: any) {
          if (err.statusCode === 409 || err.message?.includes("already assigned")) {
            return {
              status: "skipped",
              message: `Journey ${journeyId} is already assigned to ${targetUser.profile?.firstName}`,
            };
          }
          return {
            status: "failed",
            message: `Assign journey action failed: ${err.message}`,
          };
        }
      }

      case "create_task": {
        if (!action.params.taskTitle) {
          return { status: "failed", message: "taskTitle parameter missing for create_task action" };
        }
        try {
          const orgObjectId = new mongoose.Types.ObjectId(organizationId.toString());
          const authorObjectId = mongoose.Types.ObjectId.isValid(authorIdStr)
            ? new mongoose.Types.ObjectId(authorIdStr)
            : targetUser._id;

          const assignedUserId = await roleChecklistService.resolveResponsibleUser(
            orgObjectId,
            targetUser,
            action.params.taskAssigneeRole,
            authorObjectId
          );

          const offsetDays = action.params.relativeOffsetDays ?? 7;
          const calculatedDueDate = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);

          const createdTask = await taskService.createTask(organizationId, authorIdStr, {
            employeeId: targetUser._id.toString(),
            assignedToUserId: assignedUserId.toString(),
            title: action.params.taskTitle,
            description: action.params.taskDescription || "Automated task triggered by workflow",
            category: action.params.taskCategory || "general",
            stage: action.params.taskStage || "day_1",
            priority: (action.params.taskPriority as any) || "normal",
            dueDate: calculatedDueDate,
          });

          if (assignedUserId.toString() !== targetUser._id.toString()) {
            const employeeName = `${targetUser.profile?.firstName || ""} ${targetUser.profile?.lastName || ""}`.trim() || "Employee";
            notificationService.createNotification({
              organizationId,
              recipientUserId: assignedUserId,
              type: "manager_alert",
              title: `New Workflow Task for ${employeeName}`,
              message: `Task "${action.params.taskTitle}" assigned to you for ${employeeName}. Due by ${calculatedDueDate.toLocaleDateString()}.`,
              priority: action.params.taskPriority === "critical" || action.params.taskPriority === "high" ? "high" : "medium",
              data: {
                taskId: createdTask._id.toString(),
                employeeId: targetUser._id.toString(),
                deepLink: "/tasks",
              },
            }).catch((err) => console.warn("[WorkflowEngine] Assignee notification dispatch error:", err));
          }

          return {
            status: "success",
            message: `Created task "${action.params.taskTitle}" (assigned to ${action.params.taskAssigneeRole || "employee"}) for ${targetUser.profile?.firstName}`,
            output: createdTask,
          };
        } catch (err: any) {
          return {
            status: "failed",
            message: `Task creation failed: ${err.message}`,
          };
        }
      }

      case "assign_checklist": {
        const checklistTemplateId =
          action.params?.checklistTemplateId ||
          action.params?.templateId ||
          (action as any).targetTemplateId;
        if (!checklistTemplateId) {
          return {
            status: "failed",
            message: "checklistTemplateId parameter missing for assign_checklist action",
          };
        }
        try {
          const applied = await roleChecklistService.applyTemplateToUser(
            organizationId,
            checklistTemplateId,
            targetUser._id,
            authorIdStr
          );
          return {
            status: "success",
            message: `Applied checklist template "${checklistTemplateId}" (${applied.tasksCount || 0} tasks created) for ${targetUser.profile?.firstName || "employee"}`,
            output: applied,
          };
        } catch (err: any) {
          return {
            status: "failed",
            message: `Checklist template assignment failed: ${err.message}`,
          };
        }
      }

      case "send_notification": {
        if (!action.params.notificationTitle || !action.params.notificationMessage) {
          return {
            status: "failed",
            message: "Missing title or message for send_notification action",
          };
        }
        try {
          const notif = await notificationService.createNotification({
            organizationId,
            recipientUserId: targetUser._id,
            type: "announcement",
            channel: action.params.notificationChannel || "in_app",
            title: action.params.notificationTitle,
            message: action.params.notificationMessage,
            priority: "medium",
          });
          return {
            status: "success",
            message: `Sent notification to ${targetUser.profile?.firstName}`,
            output: notif,
          };
        } catch (err: any) {
          return {
            status: "failed",
            message: `Notification dispatch failed: ${err.message}`,
          };
        }
      }

      case "assign_document": {
        if (!action.params.documentTemplateId) {
          return {
            status: "failed",
            message: "documentTemplateId parameter missing for assign_document action",
          };
        }
        try {
          const docAssignment = await documentService.assignDocument(
            organizationId,
            action.params.documentTemplateId,
            targetUser._id,
            authorIdStr
          );
          return {
            status: "success",
            message: `Assigned document ${action.params.documentTemplateId} to ${targetUser.profile?.firstName}`,
            output: docAssignment,
          };
        } catch (err: any) {
          return {
            status: "failed",
            message: `Document assignment failed: ${err.message}`,
          };
        }
      }

      case "trigger_buddy": {
        try {
          if (action.params.buddyUserId) {
            const assignment = await buddyService.assignBuddy(
              organizationId,
              targetUser._id,
              action.params.buddyUserId,
              authorIdStr
            );
            return {
              status: "success",
              message: `Assigned buddy for ${targetUser.profile?.firstName}`,
              output: assignment,
            };
          } else {
            const assigned = await buddyService.autoAssignBuddyToNewHire(
              organizationId,
              targetUser._id
            );
            if (!assigned) {
              return {
                status: "failed",
                message: `Buddy assignment failed: No available buddies found in organization`,
              };
            }
            return {
              status: "success",
              message: `Auto-assigned buddy for ${targetUser.profile?.firstName}`,
            };
          }
        } catch (err: any) {
          return {
            status: "failed",
            message: `Buddy assignment failed: ${err.message}`,
          };
        }
      }

      case "trigger_webhook": {
        if (!action.params.webhookUrl) {
          return { status: "failed", message: "webhookUrl parameter missing for trigger_webhook action" };
        }
        try {
          const res = await fetch(action.params.webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: "workflow_webhook_triggered",
              organizationId: organizationId.toString(),
              targetUserId: targetUser._id.toString(),
              eventPayload,
              timestamp: new Date().toISOString(),
            }),
          });
          if (!res.ok) {
            return {
              status: "failed",
              message: `Webhook dispatch to ${action.params.webhookUrl} failed with HTTP status ${res.status}`,
              output: { statusCode: res.status },
            };
          }
          return {
            status: "success",
            message: `Triggered webhook to ${action.params.webhookUrl} with status ${res.status}`,
            output: { statusCode: res.status },
          };
        } catch (err: any) {
          return {
            status: "failed",
            message: `Webhook dispatch failed: ${err.message}`,
          };
        }
      }

      case "assign_milestone": {
        const templateId = action.params?.templateId;
        const targetDay = action.params?.targetDay;
        try {
          let resolvedTemplateId = templateId;
          if (!resolvedTemplateId) {
            const MilestoneTemplate = mongoose.model("MilestoneTemplate");
            const query: any = { organizationId: new mongoose.Types.ObjectId(organizationId), isDeleted: false };
            if (targetDay) {
              query.targetDay = targetDay;
            }
            const foundTmpl = await MilestoneTemplate.findOne(query);
            if (foundTmpl) {
              resolvedTemplateId = foundTmpl._id.toString();
            }
          }

          if (!resolvedTemplateId) {
            return {
              status: "failed",
              message: "No milestone template found for assign_milestone action",
            };
          }

          const assignedMilestone = await milestoneService.assignMilestone(
            organizationId,
            resolvedTemplateId,
            targetUser._id,
            authorIdStr
          );

          return {
            status: "success",
            message: `Assigned milestone template (${resolvedTemplateId}) to ${targetUser.profile?.firstName || "employee"}`,
            output: assignedMilestone,
          };
        } catch (err: any) {
          if (err.statusCode === 409 || err.message?.includes("already assigned")) {
            return {
              status: "skipped",
              message: `Milestone is already assigned to ${targetUser.profile?.firstName || "employee"}`,
            };
          }
          return {
            status: "failed",
            message: `Milestone assignment failed: ${err.message}`,
          };
        }
      }

      case "delay": {
        const delayMins = action.params?.delayMinutes || 0;
        return {
          status: "delayed",
          message: `Execution step delayed by ${delayMins} minutes`,
        };
      }

      default:
        return { status: "skipped", message: `Unknown action type: ${action.type}` };
    }
  }
}

export const workflowEngine = new WorkflowEngine();
export default workflowEngine;
