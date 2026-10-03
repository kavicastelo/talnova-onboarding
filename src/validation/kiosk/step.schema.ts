import { z } from "zod";
import { KioskBlockSchema } from "./block.schema.js";
import {
  KIOSK_STEP_TYPES,
  KIOSK_INTERACTION_TYPES
} from "../../constants/kiosk/index.js";

/**
 * Coordinate-based image hotspot configuration schema.
 */
export const KioskHotspotSchema = z
  .object({
    x: z.number().min(0).max(100, { message: "Coordinate percentage must be between 0 and 100" }),
    y: z.number().min(0).max(100, { message: "Coordinate percentage must be between 0 and 100" }),
    radius: z.number().min(1).max(50, { message: "Hotspot hit area radius must be between 1 and 50 percent" }),
    actionStepId: z.string().min(1, { message: "Target routing step identifier is required" })
  })
  .strict()
  .describe("Kiosk slide image hotspot tap boundary");

/**
 * Quiz question and options configuration schema.
 */
export const KioskQuizQuestionSchema = z
  .object({
    id: z.string().min(1, { message: "Question ID is required" }),
    question: z.string().min(1, { message: "Question text is required" }),
    options: z.array(z.string().min(1, { message: "Option text is required" })).min(2, { message: "At least 2 options required" }),
    correctOptionIndex: z.number().int().nonnegative({ message: "Correct option index must be non-negative integer" }),
    explanation: z.string().optional()
  })
  .strict();

/**
 * Quiz evaluation and passing score settings schema.
 */
export const KioskQuizConfigSchema = z
  .object({
    passingScore: z.number().min(50, { message: "Passing score must be at least 50%" }).max(100, { message: "Passing score cannot exceed 100%" }),
    questions: z.array(KioskQuizQuestionSchema).min(1, { message: "Quiz must have at least one question" })
  })
  .strict();

/**
 * Step interaction settings validator.
 */
export const KioskInteractionSchema = z
  .object({
    type: z.enum(KIOSK_INTERACTION_TYPES),
    holdDurationMs: z.number().int().nonnegative().optional(),
    hotspots: z.array(KioskHotspotSchema).readonly().optional(),
    correctStepId: z.string().min(1).optional(),
    incorrectStepId: z.string().min(1).optional(),
    ppeItems: z.array(z.string()).readonly().optional(),
    quiz: KioskQuizConfigSchema.optional(),
    requireSupervisorWitness: z.boolean().optional()
  })
  .strict()
  .describe("Kiosk step advance interaction behavior configuration");

/**
 * General step slide configuration schema.
 */
export const KioskStepSchema = z
  .object({
    id: z.string().min(1, { message: "Step identifier is required" }),
    type: z.enum(KIOSK_STEP_TYPES),
    title: z.string().min(1).max(200),
    order: z.number().int().nonnegative(),
    blocks: z.array(KioskBlockSchema).readonly(),
    interaction: KioskInteractionSchema,
    quiz: KioskQuizConfigSchema.optional(),
    requireSupervisorWitness: z.boolean().optional(),
    isMandatory: z.boolean().optional(),
    isOptional: z.boolean().optional()
  })
  .strict()
  .superRefine((data, ctx) => {
    // 1. Ensure block IDs are unique within the step
    const blockIds = new Set<string>();
    const blockOrders = new Set<number>();

    data.blocks.forEach((block, idx) => {
      if (blockIds.has(block.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", idx, "id"],
          message: `Duplicate block ID "${block.id}" detected in step`
        });
      }
      blockIds.add(block.id);

      // 2. Ensure block order keys are unique within the step
      if (blockOrders.has(block.order)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["blocks", idx, "order"],
          message: `Duplicate block order index "${block.order}" detected in step`
        });
      }
      blockOrders.add(block.order);
    });
  })
  .describe("Step schema with step-level validation rules");
