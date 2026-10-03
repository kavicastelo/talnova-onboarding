import { z } from "zod";
import { ObjectIdSchema, LanguageCodeSchema } from "./common.schema.js";

/**
 * Summary metrics of a single kiosk player walkthrough session.
 */
export const KioskSessionMetricsSchema = z
  .object({
    launchesCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    durationSeconds: z.number().int().nonnegative(),
    abortedStepId: z.string().optional()
  })
  .strict()
  .describe("Kiosk execution walk-through session metrics");

/**
 * Trace record of a single tap/click interaction event.
 */
export const KioskUserInteractionSchema = z
  .object({
    stepId: z.string().min(1),
    elementClicked: z.string().min(1),
    eventType: z.string().optional(),
    timestamp: z.union([z.date(), z.string().datetime()])
  })
  .strict()
  .describe("Kiosk slide element user interaction record");

/**
 * Main analytics schema for kiosk journey completions.
 */
export const KioskAnalyticsSchema = z
  .object({
    _id: ObjectIdSchema,
    organizationId: ObjectIdSchema,
    deviceId: ObjectIdSchema.optional(),
    journeyId: ObjectIdSchema,
    journeyVersion: z.number().int().positive(),
    languageUsed: LanguageCodeSchema,
    stepId: z.string().optional(),
    eventType: z.string().optional(),
    metrics: KioskSessionMetricsSchema,
    interactions: z.array(KioskUserInteractionSchema).readonly(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date key must be formatted as YYYY-MM-DD" })
  })
  .strict()
  .describe("Kiosk analytics aggregate document schema");

/**
 * Single offline buffered analytics event.
 */
export const KioskAnalyticsEventItemSchema = z
  .object({
    journeyId: z.string().min(1, { message: "journeyId is required" }),
    stepId: z.string().min(1, { message: "stepId is required" }),
    eventType: z.string().min(1, { message: "eventType is required" }),
    durationSeconds: z.number().nonnegative().optional()
  })
  .passthrough();

/**
 * Single offline completed KioskSession payload (K-OFF-003).
 */
export const CompletedKioskSessionSyncItemSchema = z
  .object({
    clientSessionId: z.string().optional(),
    sessionId: z.string().optional(),
    deviceId: z.string().optional(),
    journeyId: z.string().min(1, { message: "journeyId is required" }),
    journeyVersionId: z.string().optional(),
    versionNumber: z.number().int().positive().optional(),
    userId: z.string().optional().nullable(),
    sessionToken: z.string().optional(),
    status: z.string().optional(),
    startedAt: z.union([z.date(), z.string(), z.number()]).optional(),
    completedAt: z.union([z.date(), z.string(), z.number()]).optional(),
    durationSeconds: z.number().nonnegative().optional(),
    currentStepId: z.string().optional(),
    completedStepIds: z.array(z.string()).optional(),
    ppeItemsVerified: z.array(z.string()).optional(),
    quizScore: z.number().optional(),
    supervisorWitness: z.any().optional(),
    verificationChecksum: z.string().optional(),
    isOfflineSync: z.boolean().optional(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date key must be formatted as YYYY-MM-DD" }).optional()
  })
  .passthrough();

export const KioskAnalyticsBulkSyncObjectSchema = z
  .object({
    organizationId: z.string().optional(),
    events: z.array(KioskAnalyticsEventItemSchema).min(1).optional(),
    sessions: z.array(CompletedKioskSessionSyncItemSchema).min(1).optional(),
    completedSessions: z.array(CompletedKioskSessionSyncItemSchema).min(1).optional(),
    analytics: z.array(KioskAnalyticsSchema).min(1).optional()
  })
  .passthrough()
  .refine(
    (data) =>
      (data.events && data.events.length > 0) ||
      (data.sessions && data.sessions.length > 0) ||
      (data.completedSessions && data.completedSessions.length > 0) ||
      (data.analytics && data.analytics.length > 0),
    {
      message: "Either events or sessions array is required and must not be empty"
    }
  );

export const KioskAnalyticsBulkSyncSchema = z
  .union([
    KioskAnalyticsBulkSyncObjectSchema,
    z.array(CompletedKioskSessionSyncItemSchema).min(1)
  ])
  .describe("Bulk synced offline sessions package");

