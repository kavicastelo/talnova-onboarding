import { z } from "zod";
import { ObjectIdSchema } from "./common.schema.js";
import {
  KIOSK_SESSION_STATUSES,
  SUPERVISOR_WITNESS_METHODS,
} from "../types/session.types.js";

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
    deviceId: z.string().min(1, { message: "Device identifier is required" }),
    journeyId: z.string().min(1, { message: "Journey ID is required" }),
    journeyVersionId: z.string().optional().nullable(),
    versionNumber: z.number().int().min(1).optional().default(1),
    userId: z.string().optional().nullable(),
    sessionToken: z.string().optional(),
    currentStepId: z.string().optional(),
    status: z.enum(KIOSK_SESSION_STATUSES).optional().default("active"),
    isOfflineSync: z.boolean().optional().default(false),
  })
  .describe("Create Kiosk Session Schema");

/**
 * Step progress heartbeat and progression payload validator.
 */
export const UpdateKioskSessionProgressSchema = z
  .object({
    stepId: z.string().optional(),
    currentStepId: z.string().optional(),
    completedStepId: z.string().optional(),
    completedStepIds: z.array(z.string()).optional(),
    durationIncrement: z.number().nonnegative().optional().default(0),
    durationSeconds: z.number().nonnegative().optional(),
    ppeItemsVerified: z.array(z.string()).optional(),
  })
  .describe("Update Kiosk Session Progress Schema");

/**
 * Session completion payload validator.
 */
export const CompleteKioskSessionSchema = z
  .object({
    durationSeconds: z.number().nonnegative().optional(),
    quizScore: z.number().min(0).max(100).optional(),
    ppeItemsVerified: z.array(z.string()).optional(),
    verificationChecksum: z.string().optional(),
  })
  .optional()
  .nullable()
  .default({});

/**
 * Session abort / abandonment payload validator.
 */
export const AbortKioskSessionSchema = z
  .object({
    abortedStepId: z.string().optional(),
    reason: z.string().optional(),
    durationSeconds: z.number().nonnegative().optional(),
  })
  .optional()
  .nullable()
  .default({});

/**
 * Session timeout payload validator.
 */
export const TimeoutKioskSessionSchema = z
  .object({
    abortedStepId: z.string().optional(),
    reason: z.string().optional().default("Idle timeout exceeded"),
    durationSeconds: z.number().nonnegative().optional(),
  })
  .optional()
  .nullable()
  .default({});

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
  .describe("Transition Kiosk Session Status Schema");

/**
 * Supervisor PIN witness verification payload validator (K-SUP-001, ADR-008).
 */
export const VerifySupervisorPinSchema = z
  .object({
    supervisorIdentifier: z.string().min(1, "Supervisor identifier is required").optional(),
    supervisorId: z.string().optional(),
    badgeId: z.string().optional(),
    email: z.string().optional(),
    employeeId: z.string().optional(),
    pin: z.string().min(4, "PIN must be at least 4 digits"),
    sessionId: z.string().optional(),
    organizationId: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.supervisorIdentifier ||
          data.supervisorId ||
          data.badgeId ||
          data.email ||
          data.employeeId
      ),
    { message: "Supervisor identifier is required" }
  );

export type CreateKioskSessionInput = z.input<typeof CreateKioskSessionSchema>;
export type CreateKioskSessionOutput = z.output<typeof CreateKioskSessionSchema>;
export type UpdateKioskSessionProgressInput = z.input<
  typeof UpdateKioskSessionProgressSchema
>;
export type UpdateKioskSessionProgressOutput = z.output<
  typeof UpdateKioskSessionProgressSchema
>;
export type CompleteKioskSessionInput = z.input<typeof CompleteKioskSessionSchema>;
export type CompleteKioskSessionOutput = z.output<typeof CompleteKioskSessionSchema>;
export type AbortKioskSessionInput = z.input<typeof AbortKioskSessionSchema>;
export type AbortKioskSessionOutput = z.output<typeof AbortKioskSessionSchema>;
export type TransitionKioskSessionStatusInput = z.input<
  typeof TransitionKioskSessionStatusSchema
>;
export type TransitionKioskSessionStatusOutput = z.output<
  typeof TransitionKioskSessionStatusSchema
>;
