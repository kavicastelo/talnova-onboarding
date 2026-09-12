import { z } from "zod";

export const createTaskSchema = z.object({
  assignedToUserId: z.string().min(1, "Assigned user ID is required"),
  employeeId: z.string().optional(),
  taskCode: z.string().optional(),
  title: z.string().min(2, "Title must be at least 2 characters"),
  description: z.string().optional(),
  category: z.enum(["it_setup", "hr_paperwork", "equipment", "training", "general"]).optional(),
  stage: z.enum(["preboarding", "day_1", "week_1", "month_1", "custom"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  requiresVerification: z.boolean().optional(),
  autoVerification: z
    .object({
      enabled: z.boolean().default(false),
      ruleType: z.enum(["document_signed", "quiz_passed", "course_completed", "form_submitted"]).optional(),
      linkedEntityId: z.string().optional(),
      entityModel: z.enum(["DocumentTemplate", "Course", "Quiz"]).optional(),
      minScorePercent: z.number().optional(),
    })
    .optional(),
  dueDate: z.string().optional(),
  relativeOffsetDays: z.number().optional(),
  prerequisiteTaskIds: z.array(z.string()).optional(),
  hardwareMetadata: z
    .object({
      deviceType: z.enum(["laptop", "monitor", "mobile", "security_key", "peripherals"]).optional(),
      serialNumber: z.string().optional(),
      assetTag: z.string().optional(),
      courierTrackingUrl: z.string().optional(),
      courierProvider: z.string().optional(),
      shipDate: z.string().optional(),
      receiptAttachment: z
        .object({
          uploadId: z.string().optional(),
          fileUrl: z.string().optional(),
          fileName: z.string().optional(),
          uploadedAt: z.string().optional(),
        })
        .optional(),
      mdmStatus: z.enum(["pending_dispatch", "dispatched", "enrolled", "failed"]).optional(),
      mdmExternalId: z.string().optional(),
    })
    .optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum([
    "pending",
    "in_progress",
    "completed",
    "verified",
    "overdue",
    "cancelled",
    "needs_review",
    "revision_requested",
  ]),
  note: z.string().optional(),
});

export const addTaskCommentSchema = z.object({
  comment: z.string().min(1, "Comment text is required"),
});

export const getTasksQuerySchema = z.object({
  assignedToUserId: z.string().optional(),
  assignedToMe: z.union([z.string(), z.boolean()]).optional(),
  directReportsOnly: z.union([z.string(), z.boolean()]).optional(),
  directReports: z.union([z.string(), z.boolean()]).optional(),
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

export const updateHardwareMetadataSchema = z.object({
  deviceType: z.enum(["laptop", "monitor", "mobile", "security_key", "peripherals"]).optional(),
  serialNumber: z.string().optional(),
  assetTag: z.string().optional(),
  courierTrackingUrl: z.string().optional(),
  courierProvider: z.string().optional(),
  shipDate: z.string().optional(),
  receiptAttachment: z
    .object({
      uploadId: z.string().optional(),
      fileUrl: z.string().optional(),
      fileName: z.string().optional(),
      uploadedAt: z.string().optional(),
    })
    .optional(),
  mdmStatus: z.enum(["pending_dispatch", "dispatched", "enrolled", "failed"]).optional(),
  mdmExternalId: z.string().optional(),
});

export const attachHardwareReceiptSchema = z.object({
  uploadId: z.string().optional(),
  fileUrl: z.string().min(1, "fileUrl is required"),
  fileName: z.string().min(1, "fileName is required"),
});
