import {
  JourneyId,
  LanguageCode,
  OrganizationId,
  Timestamp,
  VersionNumber,
  KioskPublishingStatus,
  KioskSecurityProtectionType
} from "./common.types.js";
import { KioskStep } from "./step.types.js";

export interface KioskJourneySecuritySettings {
  readonly protectionType: KioskSecurityProtectionType;
  readonly pinCode?: string;
  readonly expiresAt?: Timestamp;
}

export interface KioskJourneySettings {
  readonly autoPlay: boolean;
  readonly loopForever: boolean;
  readonly idleTimeoutSeconds: number; // Returns to language gateway on inactivity
  readonly autoReturnHome: boolean;
  readonly hideNavigation: boolean; // Distraction-free, interactions only
  readonly disableExit: boolean; // Forces lockdown mode in wrapper
  readonly security: KioskJourneySecuritySettings;
}

export interface KioskPublishingSettings {
  readonly status: KioskPublishingStatus;
  readonly version: VersionNumber;
  readonly publishedAt?: Timestamp;
}

export interface KioskJourney {
  readonly _id: JourneyId;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly description?: string;
  readonly languages: readonly LanguageCode[];
  readonly steps: readonly KioskStep[];
  readonly settings: KioskJourneySettings;
  readonly publishing: KioskPublishingSettings;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly createdBy: string;
  readonly updatedBy?: string;
  readonly isDeleted: boolean;
  readonly deletedAt?: Timestamp;
}
