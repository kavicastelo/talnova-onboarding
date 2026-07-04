import { StepId } from "./common.types.js";
import { KioskBlock } from "./block.types.js";
import { KIOSK_STEP_TYPES, KIOSK_INTERACTION_TYPES } from "../../constants/kiosk/step.constants.js";

export type KioskStepType = typeof KIOSK_STEP_TYPES[number];

export type KioskInteractionType = typeof KIOSK_INTERACTION_TYPES[number];

export interface KioskHotspot {
  readonly x: number; // Percent value 0-100
  readonly y: number; // Percent value 0-100
  readonly radius: number; // Percent value 0-100 hit area size
  readonly actionStepId: StepId; // Destination step ID on click
}

export interface KioskInteraction {
  readonly type: KioskInteractionType;
  readonly holdDurationMs?: number; // For "hold_to_confirm" (default e.g. 2000ms)
  readonly hotspots?: readonly KioskHotspot[]; // For "hotspot" interaction
  readonly correctStepId?: StepId; // Router target step for successful path/Yes
  readonly incorrectStepId?: StepId; // Router target step for alternate path/No
}

export interface KioskStep {
  readonly id: StepId;
  readonly type: KioskStepType;
  readonly title: string;
  readonly order: number;
  readonly blocks: readonly KioskBlock[];
  readonly interaction: KioskInteraction;
}
