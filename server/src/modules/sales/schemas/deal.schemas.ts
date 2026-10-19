import { z } from "zod";

export const createDealSchema = z.object({
  name: z.string().min(1, "Deal name is required").max(200).trim(),
  companyId: z.string().min(1, "Company ID is required").trim(),
  primaryContactId: z.string().trim().optional(),
  leadId: z.string().trim().optional(),
  pipelineId: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  ownerId: z.string().trim().optional(),
  value: z.number().min(0, "Deal value cannot be negative").default(0),
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  annualRecurringRevenue: z.number().min(0).default(0),
  oneTimeImplementationFee: z.number().min(0).default(0),
  probability: z.number().min(0.0).max(1.0).optional(),
  expectedCloseDate: z.string().or(z.date()).optional(),
  actualCloseDate: z.string().or(z.date()).optional(),
  competitors: z.array(z.string().trim()).optional().default([]),
  nextAction: z.string().trim().optional(),
  lossReason: z.string().trim().optional(),
  lossDetails: z.string().trim().optional(),
  packageId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const updateDealSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  companyId: z.string().trim().optional(),
  primaryContactId: z.string().trim().nullable().optional(),
  leadId: z.string().trim().nullable().optional(),
  pipelineId: z.string().trim().optional(),
  stage: z.string().trim().optional(),
  ownerId: z.string().trim().nullable().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().trim().toUpperCase().length(3).optional(),
  annualRecurringRevenue: z.number().min(0).optional(),
  oneTimeImplementationFee: z.number().min(0).optional(),
  probability: z.number().min(0.0).max(1.0).optional(),
  expectedCloseDate: z.string().or(z.date()).nullable().optional(),
  actualCloseDate: z.string().or(z.date()).nullable().optional(),
  competitors: z.array(z.string().trim()).optional(),
  nextAction: z.string().trim().nullable().optional(),
  lossReason: z.string().trim().nullable().optional(),
  lossDetails: z.string().trim().nullable().optional(),
  packageId: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const updateDealStageSchema = z.object({
  stage: z.string().min(1, "Target stage is required").trim(),
  probability: z.number().min(0.0).max(1.0).optional(),
  lossReason: z.string().trim().optional(),
  lossDetails: z.string().trim().optional(),
  actualCloseDate: z.string().or(z.date()).optional(),
  wonDetails: z
    .object({
      contractSignedDate: z.string().or(z.date()).optional(),
      approvedBy: z.string().trim().optional(),
      organizationId: z.string().trim().optional(),
      onboardingHandedOff: z.boolean().default(false),
      handoffDate: z.string().or(z.date()).optional(),
    })
    .optional(),
});

export const dealQuerySchema = z.object({
  search: z.string().optional(),
  companyId: z.string().optional(),
  pipelineId: z.string().optional(),
  stage: z.string().optional(),
  ownerId: z.string().optional(),
  currency: z.string().optional(),
  minProbability: z.coerce.number().min(0).max(1).optional(),
  maxProbability: z.coerce.number().min(0).max(1).optional(),
  minValue: z.coerce.number().min(0).optional(),
  maxValue: z.coerce.number().min(0).optional(),
  minExpectedCloseDate: z.string().optional(),
  maxExpectedCloseDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["name", "value", "probability", "expectedCloseDate", "createdAt", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const kanbanQuerySchema = z.object({
  pipelineId: z.string().optional(),
  ownerId: z.string().optional(),
  currency: z.string().optional(),
  search: z.string().optional(),
});

export const pipelineSummaryQuerySchema = z.object({
  pipelineId: z.string().optional(),
  currency: z.string().optional(),
  ownerId: z.string().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type UpdateDealStageInput = z.infer<typeof updateDealStageSchema>;
export type DealQueryParams = z.infer<typeof dealQuerySchema>;
export type KanbanQueryParams = z.infer<typeof kanbanQuerySchema>;
export type PipelineSummaryQueryParams = z.infer<typeof pipelineSummaryQuerySchema>;
