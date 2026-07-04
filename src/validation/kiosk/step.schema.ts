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
 * Step interaction settings validator.
 */
export const KioskInteractionSchema = z
  .object({
    type: z.enum(KIOSK_INTERACTION_TYPES),
    holdDurationMs: z.number().int().nonnegative().optional(),
    hotspots: z.array(KioskHotspotSchema).readonly().optional(),
    correctStepId: z.string().min(1).optional(),
    incorrectStepId: z.string().min(1).optional()
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
    interaction: KioskInteractionSchema
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
