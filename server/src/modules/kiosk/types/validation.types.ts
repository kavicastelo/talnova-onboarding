import { StepId, BlockId } from "./common.types.js";

export type KioskPrepublishRule =
  | "step_structure"
  | "terminal_completion"
  | "media_asset"
  | "language_translation"
  | "quiz_correctness"
  | "supervisor_availability";

export interface ValidationErrorDetail {
  readonly stepId?: StepId | string;
  readonly blockId?: BlockId | string;
  readonly language?: string;
  readonly field?: string;
  readonly rule: KioskPrepublishRule;
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

export interface ValidationReport {
  readonly isValid: boolean;
  readonly errors: readonly ValidationErrorDetail[];
  readonly warnings: readonly ValidationErrorDetail[];
}

export interface KioskQuizQuestion {
  readonly id: string;
  readonly question: string;
  readonly options: readonly string[];
  readonly correctOptionIndex: number;
  readonly explanation?: string;
}

export interface KioskQuizConfig {
  readonly passingScore: number; // 50-100%
  readonly questions: readonly KioskQuizQuestion[];
}
