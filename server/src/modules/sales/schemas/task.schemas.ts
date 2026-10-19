import { z } from "zod";

export const taskTypeEnum = z.enum([
  "call",
  "meeting",
  "email",
  "demo",
  "proposal",
  "follow_up",
  "other",
]);

export const taskStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = z.enum(["low", "normal", "high", "urgent"]);

export const createTaskSchema = z.object({
  title: z.string().min(1, "Task title is required").max(200).trim(),
  description: z.string().trim().optional(),
  type: taskTypeEnum.default("follow_up"),
  priority: taskPriorityEnum.default("normal"),
  dueDate: z.string().or(z.date()),
  assignedTo: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  contactId: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
  dealId: z.string().trim().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().trim().nullable().optional(),
  type: taskTypeEnum.optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  dueDate: z.string().or(z.date()).optional(),
  assignedTo: z.string().trim().nullable().optional(),
  leadId: z.string().trim().nullable().optional(),
  contactId: z.string().trim().nullable().optional(),
  companyId: z.string().trim().nullable().optional(),
  dealId: z.string().trim().nullable().optional(),
  outcomeNotes: z.string().trim().nullable().optional(),
});

export const completeTaskSchema = z.object({
  outcomeNotes: z.string().trim().optional(),
  completedAt: z.string().or(z.date()).optional(),
});

export const taskQuerySchema = z.object({
  search: z.string().optional(),
  type: taskTypeEnum.optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  assignedTo: z.string().optional(),
  leadId: z.string().optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  dueFilter: z.enum(["overdue", "today", "upcoming", "all"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["dueDate", "priority", "title", "createdAt", "updatedAt"]).default("dueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const calendarQuerySchema = z.object({
  startDate: z.string({ required_error: "startDate is required" }),
  endDate: z.string({ required_error: "endDate is required" }),
  assignedTo: z.string().optional(),
  type: taskTypeEnum.optional(),
  status: taskStatusEnum.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CompleteTaskInput = z.infer<typeof completeTaskSchema>;
export type TaskQueryParams = z.infer<typeof taskQuerySchema>;
export type CalendarQueryParams = z.infer<typeof calendarQuerySchema>;
