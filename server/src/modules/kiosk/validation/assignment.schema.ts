import { z } from "zod";
import { ObjectIdSchema } from "./common.schema.js";
import { ASSIGNMENT_TARGET_TYPES } from "../types/assignment.types.js";

/**
 * Scheduling window rules validator.
 */
export const KioskAssignmentSchedulingSchema = z
  .object({
    enabled: z.boolean().default(false),
    startDate: z.union([z.date(), z.string().datetime()]).optional(),
    endDate: z.union([z.date(), z.string().datetime()]).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    startTimeUtc: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid HH:MM 24h UTC format" })
      .optional(),
    endTimeUtc: z
      .string()
      .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid HH:MM 24h UTC format" })
      .optional(),
  })
  .strict()
  .describe("Kiosk journey assignment scheduling window");

/**
 * Create kiosk device assignment payload validator.
 */
export const CreateKioskAssignmentSchema = z
  .object({
    targetType: z.enum(ASSIGNMENT_TARGET_TYPES),
    targetId: ObjectIdSchema,
    journeyId: ObjectIdSchema,
    priority: z.number().int().min(0).default(0),
    isMandatory: z.boolean().default(false),
    scheduling: KioskAssignmentSchedulingSchema.optional().default({ enabled: false }),
    isActive: z.boolean().default(true),
  })
  .strict()
  .describe("Create Kiosk Device Assignment Schema");

/**
 * Update kiosk device assignment payload validator.
 */
export const UpdateKioskAssignmentSchema = CreateKioskAssignmentSchema.partial()
  .strict()
  .describe("Update Kiosk Device Assignment Schema");

export const DeviceAssignmentItemSchema = z
  .object({
    journeyId: z.string().min(1, { message: "Journey ID is required" }),
    priority: z.number().int().min(0).optional().default(0),
    isMandatory: z.boolean().optional().default(false),
    scheduling: KioskAssignmentSchedulingSchema.optional().default({ enabled: false }),
    isActive: z.boolean().optional().default(true),
  })
  .describe("Device journey assignment item");

export const BatchDeviceAssignmentsSchema = z.union([
  z.object({
    assignments: z.array(z.union([DeviceAssignmentItemSchema, z.string()]))
  }),
  z.object({
    journeyIds: z.array(z.string())
  }),
  z.array(z.union([DeviceAssignmentItemSchema, z.string()]))
]).describe("Batch Device Assignments Schema");

export type CreateKioskAssignmentInput = z.input<typeof CreateKioskAssignmentSchema>;
export type CreateKioskAssignmentOutput = z.output<typeof CreateKioskAssignmentSchema>;
export type UpdateKioskAssignmentInput = z.input<typeof UpdateKioskAssignmentSchema>;
export type UpdateKioskAssignmentOutput = z.output<typeof UpdateKioskAssignmentSchema>;
export type DeviceAssignmentItemInput = z.input<typeof DeviceAssignmentItemSchema>;
export type BatchDeviceAssignmentsInput = z.input<typeof BatchDeviceAssignmentsSchema>;

