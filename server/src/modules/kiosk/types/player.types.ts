import { LanguageCode } from "./common.types.js";
import { KioskJourney } from "./journey.types.js";

import { KIOSK_PLAYER_STATUSES, KIOSK_PLAYER_ERROR_CODES } from "../constants/player.constants.js";

export type KioskPlayerStatus = typeof KIOSK_PLAYER_STATUSES[number];

export type KioskPlayerErrorCode = typeof KIOSK_PLAYER_ERROR_CODES[number];

export interface KioskPlayerState {
  readonly journey: KioskJourney | null;
  readonly currentStepIndex: number;
  readonly currentLanguage: LanguageCode | null;
  readonly isPlayingAudio: boolean;
  readonly volume: number; // 0.0 to 1.0
  readonly isMuted: boolean;
  readonly isFullScreen: boolean;
  readonly status: KioskPlayerStatus;
  readonly errorCode?: KioskPlayerErrorCode;
  readonly interactiveHoldActive: boolean;
  readonly interactiveHoldProgress: number; // Percentage 0 to 100
}
