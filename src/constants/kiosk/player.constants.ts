/**
 * Runtime statuses for the Kiosk Execution Player.
 */
export const KIOSK_PLAYER_STATUSES = [
  "idle",
  "language_selection",
  "playing",
  "confirmation_required",
  "completed",
  "error"
] as const;

/**
 * Custom player-specific error descriptors.
 */
export const KIOSK_PLAYER_ERROR_CODES = [
  "EXPIRED_LINK",
  "INVALID_PIN",
  "UNAUTHORIZED_DEVICE",
  "MEDIA_FAILED",
  "OFFLINE"
] as const;

/**
 * Standard default volume (0.0 to 1.0) for audio narration playback.
 */
export const DEFAULT_PLAYER_VOLUME = 0.8;

/**
 * Standard idle timeout duration before resetting to language select screen.
 */
export const DEFAULT_IDLE_TIMEOUT_SECONDS = 60;

/**
 * Minimum touch target width/height in pixels to support industrial gloves.
 */
export const MIN_TOUCH_TARGET_PX = 64;

/**
 * Minimum contrast ratio for safety warnings (conforming to WCAG AAA).
 */
export const MIN_CONTRAST_RATIO = 7;

/**
 * Percentage height of the viewport occupied by control navigation targets.
 */
export const PLAYER_CONTROL_HEIGHT_PERCENT = 20;

/**
 * Standard CSS animation slide-to-slide transition duration in milliseconds.
 */
export const DEFAULT_TRANSITION_DURATION_MS = 300;
