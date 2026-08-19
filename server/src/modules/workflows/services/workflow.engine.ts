import mongoose from "mongoose";
import WorkflowRepository from "../repositories/workflow.repository.js";
import { IWorkflowCondition, IWorkflowAction } from "../models/workflow-rule.model.js";
import User from "../../auth/models/user.model.js";
import Journey from "../../journeys/models/journey.model.js";
import EmployeeAssignmentService from "../../assignments/services/assignment.service.js";
import AssignmentRepository from "../../assignments/repositories/assignment.repository.js";
import TaskService from "../../tasks/services/task.service.js";
import TaskRepository from "../../tasks/repositories/task.repository.js";
import NotificationService from "../../notifications/services/notification.service.js";
import NotificationRepository from "../../notifications/repositories/notification.repository.js";

const assignmentService = new EmployeeAssignmentService(new AssignmentRepository());
const taskService = new TaskService(new TaskRepository());
const notificationService = new NotificationService(new NotificationRepository());

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
    triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due",
    targetUserId: string | mongoose.Types.ObjectId,
    eventPayload: any = {}
  ): Promise<number> {
    const rules = await this.repository.findRules(organizationId, triggerType, true);
    if (!rules || rules.length === 0) {
      return 0;
    }

    const targetUser = await User.findOne({
      _id: targetUserId,
      organizationId,
      isDeleted: false,
    });
    if (!targetUser) {
      console.warn(`[WorkflowEngine] Target user ${targetUserId} not found for org ${organizationId}`);
      return 0;
    }

    let executedCount = 0;

    for (const rule of rules) {
      // 1. Evaluate Rule Conditions
      const conditionsMatch = this.evaluateConditions(rule.conditions, targetUser);
      if (!conditionsMatch) {
        continue;
      }

      executedCount++;
      const stepResults: any[] = [];
      let overallStatus: "success" | "partial_failure" | "failed" | "pending_delay" = "success";
      let errorMsg: string | undefined = undefined;

      // 2. Execute Action Pipeline
      for (let i = 0; i < rule.actions.length; i++) {
        const action = rule.actions[i];
        const stepIndex = i + 1;

        try {
          const res = await this.executeAction(action, organizationId, targetUser, rule.createdBy, eventPayload);
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
        }
      }

      // 3. Write Execution Audit Log
      await this.repository.createExecutionLog({
        organizationId: new mongoose.Types.ObjectId(organizationId),
        workflowRuleId: rule._id as any,
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

    return executedCount;
  }

  /**
   * Evaluate rule condition logic against target user profile & employment fields
   */
  public evaluateConditions(conditions: IWorkflowCondition[], targetUser: any): boolean {
    if (!conditions || conditions.length === 0) {
      return true;
    }

    for (const cond of conditions) {
      let fieldValue: any = undefined;
      if (cond.field === "department") fieldValue = targetUser.employment?.department;
      else if (cond.field === "jobTitle") fieldValue = targetUser.employment?.jobTitle;
      else if (cond.field === "location") fieldValue = targetUser.employment?.location;
      else if (cond.field === "employmentStatus") fieldValue = targetUser.employment?.status;
      else if (cond.field === "role") fieldValue = targetUser.permissions?.role;

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
        if (!action.params.journeyId) {
          return { status: "failed", message: "journeyId parameter missing for assign_journey action" };
        }
        const journey = await Journey.findOne({
          _id: action.params.journeyId,
          organizationId,
          isDeleted: false,
        });
        if (!journey) {
          return { status: "failed", message: `Journey ${action.params.journeyId} not found` };
        }

        const assignment = await assignmentService.assignJourney(
          organizationId,
          targetUser._id,
          action.params.journeyId,
          authorIdStr,
          {
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days
          }
        );
        return {
          status: "success",
          message: `Assigned journey "${journey.title}" to ${targetUser.profile?.firstName}`,
          output: assignment,
        };
      }

      case "create_task": {
        if (!action.params.taskTitle) {
          return { status: "failed", message: "taskTitle parameter missing for create_task action" };
        }

        let assigneeUserId = targetUser._id.toString();
        if (action.params.taskAssigneeRole === "manager" && targetUser.employment?.managerUserId) {
          assigneeUserId = targetUser.employment.managerUserId.toString();
        } else if (action.params.taskAssigneeRole === "hr" || action.params.taskAssigneeRole === "it") {
          assigneeUserId = authorIdStr;
        }

        const newTask = await taskService.createTask(organizationId, authorIdStr, {
          title: action.params.taskTitle,
          description: action.params.taskDescription || `Automated workflow task for ${targetUser.profile?.firstName}`,
          assignedToUserId: assigneeUserId,
          employeeId: targetUser._id.toString(),
          category: action.params.taskCategory || "general",
          stage: action.params.taskStage || "day_1",
          priority: action.params.taskPriority || "normal",
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Default 3 days
        });

        return {
          status: "success",
          message: `Created task "${action.params.taskTitle}" assigned to user`,
          output: newTask,
        };
      }

      case "send_notification": {
        const title = action.params.notificationTitle || "Workflow Notification";
        const message =
          action.params.notificationMessage || `Hello ${targetUser.profile?.firstName}, you have an update.`;

        const notification = await notificationService.createNotification({
          organizationId: organizationId as any,
          recipientUserId: targetUser._id as any,
          type: "announcement",
          channel: action.params.notificationChannel || "in_app",
          title,
          message,
          priority: "medium",
        });

        return { status: "success", message: `Sent notification: "${title}"`, output: notification };
      }

      case "trigger_buddy": {
        return {
          status: "success",
          message: `Triggered buddy pairing notification for ${targetUser.profile?.firstName}`,
        };
      }

      case "delay": {
        const delayMins = action.params.delayMinutes || 0;
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
