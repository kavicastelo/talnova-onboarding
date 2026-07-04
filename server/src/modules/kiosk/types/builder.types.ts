import { LanguageCode } from "./common.types.js";
import { KioskJourney } from "./journey.types.js";

import { KIOSK_BUILDER_VALIDATION_TYPES } from "../constants/builder.constants.js";

export type KioskBuilderValidationType = typeof KIOSK_BUILDER_VALIDATION_TYPES[number];

export interface KioskBuilderValidationError {
  readonly stepId?: string;
  readonly blockId?: string;
  readonly type: KioskBuilderValidationType;
  readonly message: string;
}

export interface KioskBuilderState {
  readonly activeJourney: KioskJourney | null;
  readonly selectedStepId: string | null;
  readonly selectedBlockId: string | null;
  readonly isSaving: boolean;
  readonly validationErrors: readonly KioskBuilderValidationError[];
  readonly hasUnsavedChanges: boolean;
  readonly activeLanguage: LanguageCode;
}
