/**
 * Available step types within a Kiosk Journey.
 */
export const KIOSK_STEP_TYPES = [
  "image_step",
  "video_step",
  "audio_step",
  "animation_step",
  "warning_step",
  "instruction_step",
  "interactive_confirmation",
  "countdown_step",
  "emergency_step",
  "info_step",
  "completion"
] as const;

/**
 * Available user interaction mechanisms on steps.
 */
export const KIOSK_INTERACTION_TYPES = [
  "none",
  "tap_to_continue",
  "hold_to_confirm",
  "yes_no",
  "hotspot",
  "swipe"
] as const;

/**
 * Maximum steps allowed in a single Kiosk Journey to respect MongoDB size boundaries.
 */
export const MAX_STEPS_PER_JOURNEY = 50;

/**
 * Default radius size for image hotspot touch areas in percent.
 */
export const DEFAULT_HOTSPOT_RADIUS_PERCENT = 10;

/**
 * Default press-hold duration required to advance confirmation slides.
 */
export const DEFAULT_HOLD_DURATION_MS = 2000;
