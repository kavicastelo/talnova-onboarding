import { z } from "zod";
import { ObjectIdSchema, KioskDeviceStatusSchema } from "./common.schema.js";
import { KIOSK_COMMAND_TYPES, PAIR_CODE_LENGTH } from "../../constants/kiosk/index.js";

/**
 * Diagnostic metrics and status reported by the kiosk client terminal.
 */
export const KioskTelemetrySchema = z
  .object({
    batteryLevel: z.number().min(0).max(1).optional(),
    isCharging: z.boolean().optional(),
    storageUsedBytes: z.number().int().nonnegative().optional(),
    storageFreeBytes: z.number().int().nonnegative().optional(),
    appVersion: z.string().min(1).optional(),
    networkLatencyMs: z.number().int().nonnegative().optional()
  })
  .strict()
  .describe("Kiosk device hardware telemetry data");

/**
 * Registered physical kiosk device validator.
 */
export const KioskDeviceSchema = z
  .object({
    _id: ObjectIdSchema,
    organizationId: ObjectIdSchema,
    deviceId: z.string().min(1, { message: "Hardware GUID fingerprint is required" }),
    name: z.string().min(1).max(100),
    location: z.string().min(1).max(200),
    status: KioskDeviceStatusSchema,
    lastSeen: z.union([z.date(), z.string().datetime()]),
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, { message: "Invalid IP address format" }).optional(),
    macAddress: z.string().regex(/^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/, { message: "Invalid MAC address format" }).optional(),
    pairedAt: z.union([z.date(), z.string().datetime()]).optional(),
    currentJourneyId: ObjectIdSchema.optional(),
    currentContentVersion: z.number().int().nonnegative(),
    telemetry: KioskTelemetrySchema
  })
  .strict()
  .describe("Kiosk device record validator");

/**
 * Validator schema for registering/pairing a new kiosk device.
 */
export const KioskDeviceRegistrationSchema = z
  .object({
    deviceId: z.string().min(1, { message: "Hardware GUID fingerprint is required" }),
    name: z.string().min(1).max(100),
    location: z.string().min(1).max(200),
    ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, { message: "Invalid IP address format" }).optional(),
    macAddress: z.string().regex(/^([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}$/, { message: "Invalid MAC address format" }).optional()
  })
  .strict();

/**
 * Validator for 6-digit verification pairing activation code.
 */
export const KioskDevicePairCodeSchema = z
  .object({
    pairCode: z.string().length(PAIR_CODE_LENGTH, { message: `Pair code must be exactly ${PAIR_CODE_LENGTH} characters` })
  })
  .strict();

/**
 * Telemetry and heartbeat ping payload validator.
 */
export const KioskDeviceHeartbeatSchema = z
  .object({
    currentContentVersion: z.number().int().nonnegative(),
    telemetry: KioskTelemetrySchema
  })
  .strict();

/**
 * Remote administrator command schema validator.
 */
export const KioskRemoteCommandSchema = z
  .object({
    command: z.enum(KIOSK_COMMAND_TYPES),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .strict()
  .describe("Kiosk terminal admin command dispatch schema");
