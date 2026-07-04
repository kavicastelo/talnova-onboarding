import { KIOSK_DEVICE_STATUSES } from "../../constants/kiosk/device.constants.js";
import { KIOSK_SECURITY_PROTECTION_TYPES } from "../../constants/kiosk/security.constants.js";

// Common kiosk types and brand identifiers
export type LanguageCode = string; // e.g. "en" | "pt" | "es"
export type UploadId = string;
export type JourneyId = string;
export type DeviceId = string;
export type OrganizationId = string;
export type VersionNumber = number;
export type Timestamp = Date | string; // Used for Date representations in database and over network
export type BlockId = string;
export type StepId = string;
export type TelemetryId = string;
export type AnalyticsId = string;

export type KioskDeviceStatus = typeof KIOSK_DEVICE_STATUSES[number];

export type KioskPublishingStatus = "draft" | "published" | "archived";

export type KioskSecurityProtectionType = typeof KIOSK_SECURITY_PROTECTION_TYPES[number];

