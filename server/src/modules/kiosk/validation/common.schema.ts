import { z } from "zod";
import {
  KIOSK_DEVICE_STATUSES,
  KIOSK_SECURITY_PROTECTION_TYPES,
  MIN_PIN_LENGTH,
  MAX_PIN_LENGTH
} from "../constants/index.js";

/**
 * Validator for MongoDB ObjectID format
 */
export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { message: "Invalid ObjectId format" })
  .describe("MongoDB ObjectId identifier");

/**
 * Generic non-empty string identifier
 */
export const IdSchema = z
  .string()
  .min(1, { message: "Identifier cannot be empty" })
  .describe("Entity identifier");

/**
 * ISO 639-1 two-letter language code validator, with optional region extension
 */
export const LanguageCodeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
    message: "Invalid language code format (expected ISO 639-1, e.g. 'en', 'pt-BR')"
  })
  .describe("ISO Language code identifier");

/**
 * Strict numeric-only PIN code validation
 */
export const PinCodeSchema = z
  .string()
  .regex(/^\d+$/, { message: "PIN code must contain digits only" })
  .min(MIN_PIN_LENGTH, { message: `PIN must be at least ${MIN_PIN_LENGTH} digits` })
  .max(MAX_PIN_LENGTH, { message: `PIN must be at most ${MAX_PIN_LENGTH} digits` })
  .describe("Numeric security entry PIN");

/**
 * Device active status validator
 */
export const KioskDeviceStatusSchema = z.enum(KIOSK_DEVICE_STATUSES);

/**
 * Kiosk link access protection mode validator
 */
export const KioskSecurityProtectionTypeSchema = z.enum(KIOSK_SECURITY_PROTECTION_TYPES);
