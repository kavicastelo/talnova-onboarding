import { z } from "zod";

const workflowConditionSchema = z.object({
  field: z.enum(["department", "role", "jobTitle", "location", "employmentStatus"]),
  operator: z.enum(["equals", "not_equals", "in", "contains"]),
  value: z.union([z.string(), z.array(z.string())]),
});

const workflowActionSchema = z.object({
  type: z.enum(["assign_journey", "create_task", "send_notification", "trigger_buddy", "delay"]),
  params: z.object({
    journeyId: z.string().optional(),
    taskTitle: z.string().optional(),
    taskDescription: z.string().optional(),
    taskCategory: z.enum(["it_setup", "hr_paperwork", "equipment", "training", "general"]).optional(),
    taskStage: z.enum(["preboarding", "day_1", "week_1", "month_1", "custom"]).optional(),
    taskPriority: z.enum(["low", "normal", "high", "critical"]).optional(),
    taskAssigneeRole: z.enum(["employee", "manager", "hr", "it"]).optional(),
    notificationTitle: z.string().optional(),
    notificationMessage: z.string().optional(),
    notificationChannel: z.enum(["in_app", "email"]).optional(),
    delayMinutes: z.number().optional(),
  }),
});

export const createWorkflowRuleSchema = z.object({
  name: z.string().min(2, "Rule name is required"),
  description: z.string().optional(),
  triggerType: z.enum(["user_created", "journey_completed", "task_completed", "stage_entered", "checkin_due"]),
  conditions: z.array(workflowConditionSchema).optional(),
  actions: z.array(workflowActionSchema).min(1, "At least one action is required"),
  isActive: z.boolean().optional(),
});

export const updateWorkflowRuleSchema = createWorkflowRuleSchema.partial();

export const toggleWorkflowRuleSchema = z.object({
  isActive: z.boolean(),
});

export const getExecutionLogsQuerySchema = z.object({
  ruleId: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const testRunWorkflowSchema = z.object({
  targetUserId: z.string().min(1, "Target user ID is required"),
});
