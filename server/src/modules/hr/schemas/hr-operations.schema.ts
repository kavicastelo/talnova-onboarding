import { z } from "zod";

export const updateLifecycleStateSchema = z.object({
  state: z.enum(["active", "paused", "completed", "archived"]),
  reason: z.string().optional(),
  extensionDays: z.number().min(0).optional(),
});

export const executeHRBulkActionSchema = z.object({
  action: z.enum(["assign_journey", "request_document", "send_reminder"]),
  employeeIds: z.array(z.string()).min(1, "At least one employee must be selected"),
  payload: z
    .object({
      journeyId: z.string().optional(),
      templateId: z.string().optional(),
      message: z.string().optional(),
    })
    .optional()
    .default({}),
});
