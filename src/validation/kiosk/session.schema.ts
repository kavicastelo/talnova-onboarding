import { z } from "zod";
import { ObjectIdSchema } from "./common.schema.js";
import {
  KIOSK_SESSION_STATUSES,
  SUPERVISOR_WITNESS_METHODS,
} from "../../types/kiosk/session.types.js";

/**
 * Supervisor co-signature validation schema.
 */
export const KioskSupervisorWitnessSchema = z
  .object({
    supervisorId: ObjectIdSchema,
    witnessedAt: z.union([z.date(), z.string().datetime()]).optional(),
    method: z.enum(SUPERVISOR_WITNESS_METHODS).default("pin"),
  })
  .strict()
  .describe("Supervisor Witness Signature");

/**
 * Start/create new kiosk session payload validator.
 */
export const CreateKioskSessionSchema = z
  .object({
    deviceId: ObjectIdSchema,
    journeyId: ObjectIdSchema,
    journeyVersionId: ObjectIdSchema.optional(),
    versionNumber: z.number().int().min(1).default(1),
    userId: ObjectIdSchema.optional(),
    sessionToken: z.string().min(1, { message: "Session token is required" }),
    status: z.enum(KIOSK_SESSION_STATUSES).default("active"),
    isOfflineSync: z.boolean().default(false),
  })
  .strict()
  .describe("Create Kiosk Session Schema");

/**
 * Step progress heartbeat and progression payload validator.
 */
export const UpdateKioskSessionProgressSchema = z
  .object({
    stepId: z.string().min(1, { message: "Step ID is required" }),
    durationIncrement: z.number().nonnegative().optional().default(0),
  })
  .strict()
  .describe("Update Kiosk Session Progress Schema");

/**
 * Session status state transition payload validator.
 */
export const TransitionKioskSessionStatusSchema = z
  .object({
    status: z.enum(KIOSK_SESSION_STATUSES),
    quizScore: z.number().min(0).max(100).optional(),
    ppeItemsVerified: z.array(z.string()).optional(),
    supervisorWitness: KioskSupervisorWitnessSchema.optional(),
    verificationChecksum: z.string().optional(),
    durationIncrement: z.number().nonnegative().optional(),
  })
  .strict()
  .describe("Transition Kiosk Session Status Schema");

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
