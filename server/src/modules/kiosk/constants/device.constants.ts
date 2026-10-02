/**
 * Active statuses for registered kiosk terminals.
 */
export const KIOSK_DEVICE_STATUSES = [
  "staged",
  "online",
  "offline",
  "maintenance",
  "suspended",
  "decommissioned"
] as const;

export const KIOSK_COMMAND_TYPES = [
  "RELOAD_MANIFEST",
  "ENTER_MAINTENANCE",
  "EXIT_MAINTENANCE",
  "CLEAR_CACHE",
  "FORCE_RESET",
  "RESTART_APP",
  "reload_manifest",
  "enter_maintenance",
  "exit_maintenance",
  "clear_cache",
  "force_reset",
  "restart_app",
  "refresh_cache",
  "clear_storage",
  "emergency_override"
] as const;

/**
 * Frequency of telemetry heartbeat transmission in milliseconds.
 */
export const DEFAULT_HEARTBEAT_INTERVAL_MS = 60000;

/**
 * The standard length of a numeric pairing activation code.
 */
export const PAIR_CODE_LENGTH = 6;

/**
 * Number of minutes a device pairing code remains valid before recycling.
 */
export const PAIR_CODE_EXPIRATION_MINUTES = 10;
