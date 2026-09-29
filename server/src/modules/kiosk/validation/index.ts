import { z } from "zod";

export * from "./common.schema.js";
export * from "./block.schema.js";
export * from "./step.schema.js";
export * from "./journey.schema.js";
export * from "./device.schema.js";
export * from "./assignment.schema.js";
export * from "./session.schema.js";
export * from "./analytics.schema.js";
export * from "./player.schema.js";
export * from "./builder.schema.js";

import { KioskJourneySchema, CreateKioskJourneySchema } from "./journey.schema.js";
import { KioskDeviceRegistrationSchema, KioskDeviceHeartbeatSchema } from "./device.schema.js";
import { CreateKioskAssignmentSchema, UpdateKioskAssignmentSchema } from "./assignment.schema.js";
import {
  CreateKioskSessionSchema,
  UpdateKioskSessionProgressSchema,
  TransitionKioskSessionStatusSchema,
} from "./session.schema.js";
import { KioskAnalyticsBulkSyncSchema } from "./analytics.schema.js";
import { KioskStepSchema } from "./step.schema.js";
import { KioskBlockSchema } from "./block.schema.js";

// Inferred Input/Output Types
export type KioskJourneyInput = z.input<typeof KioskJourneySchema>;
export type KioskJourneyOutput = z.output<typeof KioskJourneySchema>;

export type CreateKioskJourneyInput = z.input<typeof CreateKioskJourneySchema>;
export type CreateKioskJourneyOutput = z.output<typeof CreateKioskJourneySchema>;

export type KioskDeviceRegistrationInput = z.input<typeof KioskDeviceRegistrationSchema>;
export type KioskDeviceRegistrationOutput = z.output<typeof KioskDeviceRegistrationSchema>;

export type KioskDeviceHeartbeatInput = z.input<typeof KioskDeviceHeartbeatSchema>;
export type KioskDeviceHeartbeatOutput = z.output<typeof KioskDeviceHeartbeatSchema>;

export type CreateKioskAssignmentInput = z.input<typeof CreateKioskAssignmentSchema>;
export type CreateKioskAssignmentOutput = z.output<typeof CreateKioskAssignmentSchema>;

export type UpdateKioskAssignmentInput = z.input<typeof UpdateKioskAssignmentSchema>;
export type UpdateKioskAssignmentOutput = z.output<typeof UpdateKioskAssignmentSchema>;

export type CreateKioskSessionInput = z.input<typeof CreateKioskSessionSchema>;
export type CreateKioskSessionOutput = z.output<typeof CreateKioskSessionSchema>;

export type UpdateKioskSessionProgressInput = z.input<
  typeof UpdateKioskSessionProgressSchema
>;
export type UpdateKioskSessionProgressOutput = z.output<
  typeof UpdateKioskSessionProgressSchema
>;

export type TransitionKioskSessionStatusInput = z.input<
  typeof TransitionKioskSessionStatusSchema
>;
export type TransitionKioskSessionStatusOutput = z.output<
  typeof TransitionKioskSessionStatusSchema
>;

export type KioskAnalyticsBulkSyncInput = z.input<typeof KioskAnalyticsBulkSyncSchema>;
export type KioskAnalyticsBulkSyncOutput = z.output<typeof KioskAnalyticsBulkSyncSchema>;

export type KioskStepInput = z.input<typeof KioskStepSchema>;
export type KioskStepOutput = z.output<typeof KioskStepSchema>;

export type KioskBlockInput = z.input<typeof KioskBlockSchema>;
export type KioskBlockOutput = z.output<typeof KioskBlockSchema>;

/**
 * Validates data against a schema and throws a structured ZodError if invalid.
 */
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Validates data against a schema safely, returning a Zod SafeParseResult.
 */
export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown) {
  return schema.safeParse(data);
}
