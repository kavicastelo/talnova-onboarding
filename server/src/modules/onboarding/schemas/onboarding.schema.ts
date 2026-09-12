import { z } from "zod";

export const getExceptionsQuerySchema = z.object({
  state: z.enum(["all", "paused", "provisioning_failed", "handover_pending"]).optional(),
  severity: z.enum(["critical", "high", "medium"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const resolveExceptionSchema = z.object({
  action: z.enum(["retry", "override_journey", "force_activate", "cancel"]),
  targetTemplateId: z.string().optional(),
  reason: z
    .string({ required_error: "Reason is required for regulatory audit compliance" })
    .min(10, "Resolution reason must be at least 10 characters long"),
  employmentUpdates: z
    .object({
      department: z.string().optional(),
      jobTitle: z.string().optional(),
      managerId: z.string().optional(),
    })
    .optional(),
});

export type GetExceptionsQuery = z.infer<typeof getExceptionsQuerySchema>;
export type ResolveExceptionBody = z.infer<typeof resolveExceptionSchema>;
