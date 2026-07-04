import { DEFAULT_IDLE_TIMEOUT_SECONDS } from "./player.constants.js";

/**
 * Standard configuration defaults for new Kiosk Journeys.
 */
export const DEFAULT_KIOSK_JOURNEY_SETTINGS = Object.freeze({
  autoPlay: false,
  loopForever: false,
  idleTimeoutSeconds: DEFAULT_IDLE_TIMEOUT_SECONDS,
  autoReturnHome: true,
  hideNavigation: false,
  disableExit: true,
  security: Object.freeze({
    protectionType: "none",
    pinCode: "",
    expiresAt: null
  })
});

/**
 * Fallback application execution language.
 */
export const DEFAULT_LANGUAGE_CODE = "en";

/**
 * Default cache database version identifier.
 */
export const DEFAULT_CACHE_VERSION = 1;
