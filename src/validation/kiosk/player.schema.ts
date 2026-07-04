import { z } from "zod";
import { LanguageCodeSchema } from "./common.schema.js";
import { KioskJourneySchema } from "./journey.schema.js";
import { KIOSK_PLAYER_STATUSES, KIOSK_PLAYER_ERROR_CODES } from "../../constants/kiosk/index.js";

/**
 * Validator schema for Kiosk Player runtime memory state.
 */
export const KioskPlayerStateSchema = z
  .object({
    journey: KioskJourneySchema.nullable(),
    currentStepIndex: z.number().int().nonnegative(),
    currentLanguage: LanguageCodeSchema.nullable(),
    isPlayingAudio: z.boolean(),
    volume: z.number().min(0).max(1),
    isMuted: z.boolean(),
    isFullScreen: z.boolean(),
    status: z.enum(KIOSK_PLAYER_STATUSES),
    errorCode: z.enum(KIOSK_PLAYER_ERROR_CODES).optional(),
    interactiveHoldActive: z.boolean(),
    interactiveHoldProgress: z.number().min(0).max(100)
  })
  .strict()
  .describe("Kiosk Player memory execution state validator");
