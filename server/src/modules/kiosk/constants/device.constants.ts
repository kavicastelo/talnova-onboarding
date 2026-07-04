/**
 * Active statuses for registered kiosk terminals.
 */
export const KIOSK_DEVICE_STATUSES = ["online", "offline", "decommissioned"] as const;

/**
 * Remote administration commands sent to devices over heartbeats.
 */
export const KIOSK_COMMAND_TYPES = ["refresh_cache", "restart_app", "clear_storage"] as const;

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
