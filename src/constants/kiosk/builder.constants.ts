/**
 * Classification types for builder audit validation.
 */
export const KIOSK_BUILDER_VALIDATION_TYPES = [
  "missing_audio",
  "missing_media",
  "invalid_routing",
  "accessibility",
  "step_structure",
  "terminal_completion",
  "media_asset",
  "language_translation",
  "quiz_correctness",
  "supervisor_availability"
] as const;

/**
 * Maximum localization languages allowed per individual kiosk journey.
 */
export const MAX_LANGUAGES_SUPPORTED = 10;
