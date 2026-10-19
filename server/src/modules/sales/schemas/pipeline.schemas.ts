import { z } from "zod";

export const pipelineStageSchema = z.object({
  key: z
    .string()
    .min(1, "Stage key is required")
    .max(60)
    .regex(/^[a-z0-9_-]+$/, "Stage key must be lowercase alphanumeric with underscores or hyphens")
    .trim(),
  name: z.string().min(1, "Stage name is required").max(100).trim(),
  probability: z
    .number({ required_error: "Probability is required" })
    .min(0.0, "Probability must be between 0.0 and 1.0")
    .max(1.0, "Probability must be between 0.0 and 1.0"),
  order: z.number().int().min(0, "Stage order must be a non-negative integer"),
  requiredFields: z.array(z.string().trim()).default([]),
  slaDays: z.number().int().min(0).optional(),
});

export const createPipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required").max(100).trim(),
  isDefault: z.boolean().default(false),
  stages: z.array(pipelineStageSchema).optional(),
});

export const updatePipelineSchema = z.object({
  name: z.string().min(1, "Pipeline name is required").max(100).trim().optional(),
  isDefault: z.boolean().optional(),
});

export const setStagesSchema = z.object({
  stages: z
    .array(pipelineStageSchema)
    .min(1, "Pipeline must contain at least one stage")
    .refine((stages) => {
      const keys = stages.map((s) => s.key);
      return new Set(keys).size === keys.length;
    }, {
      message: "Stage keys must be unique within a pipeline",
    }),
});

export const updateStageSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  probability: z.number().min(0.0).max(1.0).optional(),
  order: z.number().int().min(0).optional(),
  requiredFields: z.array(z.string().trim()).optional(),
  slaDays: z.number().int().min(0).optional(),
});

export type PipelineStageInput = z.infer<typeof pipelineStageSchema>;
export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type SetStagesInput = z.infer<typeof setStagesSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
