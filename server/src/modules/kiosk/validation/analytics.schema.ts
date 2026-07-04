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
    metrics: KioskSessionMetricsSchema,
    interactions: z.array(KioskUserInteractionSchema).readonly(),
    dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date key must be formatted as YYYY-MM-DD" })
  })
  .strict()
  .describe("Kiosk analytics aggregate document schema");

/**
 * Payload validator for bulk synchronizing offline session tracking logs.
 */
export const KioskAnalyticsBulkSyncSchema = z
  .object({
    sessions: z.array(
      KioskAnalyticsSchema.omit({
        _id: true,
        organizationId: true
      }).strict()
    )
  })
  .strict()
  .describe("Bulk synced offline sessions package");
