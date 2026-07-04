import { z } from "zod";
import { LanguageCodeSchema } from "./common.schema.js";
import { KioskJourneySchema } from "./journey.schema.js";
import { KIOSK_BUILDER_VALIDATION_TYPES } from "../../constants/kiosk/index.js";

/**
 * Validation error schema generated during visual editing constraints check.
 */
export const KioskBuilderValidationErrorSchema = z
  .object({
    stepId: z.string().optional(),
    blockId: z.string().optional(),
    type: z.enum(KIOSK_BUILDER_VALIDATION_TYPES),
    message: z.string().min(1)
  })
  .strict()
  .describe("Kiosk builder workspace validation error record");

/**
 * Validator schema for the visual builder workspace memory state.
 */
export const KioskBuilderStateSchema = z
  .object({
    activeJourney: KioskJourneySchema.nullable(),
    selectedStepId: z.string().nullable(),
    selectedBlockId: z.string().nullable(),
    isSaving: z.boolean(),
    validationErrors: z.array(KioskBuilderValidationErrorSchema),
    hasUnsavedChanges: z.boolean(),
    activeLanguage: LanguageCodeSchema
  })
  .strict()
  .describe("Kiosk builder console workspace state validator");
