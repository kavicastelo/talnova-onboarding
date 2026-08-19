import { z } from "zod";

export const createTaskSchema = z.object({
  assignedToUserId: z.string().min(1, "Assigned user ID is required"),
  employeeId: z.string().optional(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  category: z.enum(["it_setup", "hr_paperwork", "equipment", "training", "general"]).optional(),
  stage: z.enum(["preboarding", "day_1", "week_1", "month_1", "custom"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  dueDate: z.string().optional(),
  relativeOffsetDays: z.number().optional(),
  prerequisiteTaskIds: z.array(z.string()).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled"]),
  note: z.string().optional(),
});

export const addTaskCommentSchema = z.object({
  comment: z.string().min(1, "Comment text is required"),
});

export const getTasksQuerySchema = z.object({
  assignedToUserId: z.string().optional(),
  employeeId: z.string().optional(),
  createdBy: z.string().optional(),
  status: z.string().optional(),
  stage: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  isOverdue: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
