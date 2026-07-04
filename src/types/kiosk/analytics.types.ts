import {
  AnalyticsId,
  DeviceId,
  JourneyId,
  LanguageCode,
  OrganizationId,
  Timestamp,
  VersionNumber
} from "./common.types.js";

export interface KioskSessionMetrics {
  readonly launchesCount: number;
  readonly completedCount: number;
  readonly durationSeconds: number;
  readonly abortedStepId?: string; // Step identifier where idle timeout triggered / user walked away
}

export interface KioskUserInteraction {
  readonly stepId: string;
  readonly elementClicked: string; // e.g. "next", "prev", "replay_audio", "yes", "no", "hotspot_1"
  readonly timestamp: Timestamp;
}

export interface KioskAnalytics {
  readonly _id: AnalyticsId;
  readonly organizationId: OrganizationId;
  readonly deviceId?: DeviceId;
  readonly journeyId: JourneyId;
  readonly journeyVersion: VersionNumber;
  readonly languageUsed: LanguageCode;
  readonly metrics: KioskSessionMetrics;
  readonly interactions: readonly KioskUserInteraction[];
  readonly dateKey: string;
}

export interface KioskAnalyticsSummary {
  readonly totalLaunches: number;
  readonly totalCompletions: number;
  readonly sessionsCount: number;
  readonly completionRate: number;
  readonly averageDurationSeconds: number;
  readonly languagesUsed: readonly string[];
  readonly languageBreakdown: readonly {
    readonly language: string;
    readonly count: number;
  }[];
}
