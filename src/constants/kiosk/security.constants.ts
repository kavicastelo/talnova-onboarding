/**
 * Supported access protection strategies for kiosk links.
 */
export const KIOSK_SECURITY_PROTECTION_TYPES = [
  "none",
  "pin",
  "qr",
  "device_only",
  "signed_url"
] as const;

/**
 * URL query parameters used to validate cryptographically signed access.
 */
export const SIGNED_URL_QUERY_KEYS = {
  ORGANIZATION_ID: "o",
  EXPIRATION: "exp",
  SIGNATURE: "sig"
} as const;

/**
 * Standard minimum characters for PIN code settings.
 */
export const MIN_PIN_LENGTH = 4;

/**
 * Standard maximum characters for PIN code settings.
 */
export const MAX_PIN_LENGTH = 8;

/**
 * Local storage key used to track offline content structure caching index.
 */
export const CACHE_VERSION_KEY = "talnova_kiosk_cache_v1";

/**
 * Essential claims present inside a registered device JWT token.
 */
export const KIOSK_JWT_CLAIMS = {
  ORGANIZATION_ID: "orgId",
  DEVICE_ID: "deviceId",
  ROLE: "role"
} as const;
