import { z } from "zod";
import { ObjectIdSchema, KioskDeviceStatusSchema } from "./common.schema.js";
import { KIOSK_COMMAND_TYPES, PAIR_CODE_LENGTH } from "../constants/index.js";

/**
 * Diagnostic metrics and status reported by the kiosk client terminal.
 */
export const KioskTelemetrySchema = z
  .object({
    batteryLevel: z.number().min(0).max(100).optional(),
    isCharging: z.boolean().optional(),
    storageUsedBytes: z.number().int().nonnegative().optional(),
    storageFreeBytes: z.number().int().nonnegative().optional(),
    storageTotalBytes: z.number().int().nonnegative().optional(),
    appVersion: z.string().min(1).optional(),
    networkLatencyMs: z.number().int().nonnegative().optional(),
    screenResolution: z.string().optional(),
    orientation: z.string().optional()
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
    currentContentVersion: z.number().int().nonnegative().optional().default(0),
    telemetry: KioskTelemetrySchema.optional(),
    batteryLevel: z.number().min(0).max(100).optional(),
    appVersion: z.string().optional(),
    isCharging: z.boolean().optional(),
    storageUsedBytes: z.number().int().nonnegative().optional(),
    storageFreeBytes: z.number().int().nonnegative().optional(),
    storageTotalBytes: z.number().int().nonnegative().optional(),
    networkLatencyMs: z.number().int().nonnegative().optional(),
    screenResolution: z.string().optional(),
    orientation: z.string().optional(),
    screenOrientation: z.string().optional()
  })
  .passthrough();

/**
 * Remote administrator command schema validator.
 */
export const KioskRemoteCommandSchema = z
  .object({
    type: z.string().optional(),
    command: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional()
  })
  .refine((data) => Boolean(data.type || data.command), {
    message: "Either type or command must be provided"
  })
  .describe("Kiosk terminal admin command dispatch schema");

/**
 * MDM Zero-Touch Managed AppConfig Enrollment Schema (K-ENT-002)
 */
export const MdmEnrollmentSchema = z
  .object({
    organizationSlug: z.string().min(1, "Organization slug is required"),
    enrollmentSecret: z.string().min(1, "MDM enrollment secret is required"),
    deviceId: z.string().optional(),
    deviceHardwareId: z.string().optional(),
    name: z.string().optional(),
    deviceName: z.string().optional(),
    location: z.string().optional(),
    siteId: z.string().optional(),
    deviceModel: z.string().optional(),
    osVersion: z.string().optional(),
    appVersion: z.string().optional(),
  })
  .refine((data) => Boolean(data.deviceId || data.deviceHardwareId), {
    message: "Either deviceId or deviceHardwareId is required",
  })
  .describe("MDM Zero-Touch bulk enrollment schema");

