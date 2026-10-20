import argon2 from "argon2";
import crypto from "crypto";
import { appConfig, securityConfig } from "../config/index.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const KEY_VERSION_V1 = "v1";

let cachedMasterKey: Buffer | null = null;

/**
 * Resolves the 256-bit AES master key strictly isolated from JWT and cookie secrets.
 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey && process.env.NODE_ENV !== "test") {
    return cachedMasterKey;
  }

  const rawKey = securityConfig?.encryptionMasterKey || process.env.ENCRYPTION_MASTER_KEY;
  const isProduction = appConfig?.isProduction ?? process.env.NODE_ENV === "production";

  if (rawKey && rawKey.trim().length > 0) {
    const trimmed = rawKey.trim();

    // 64-character hex string representing a 256-bit AES key
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      cachedMasterKey = Buffer.from(trimmed, "hex");
      return cachedMasterKey;
    }

    // Direct buffer length check for raw byte inputs
    const rawBuffer = Buffer.from(trimmed, "utf8");
    if (rawBuffer.length >= 32) {
      cachedMasterKey = rawBuffer.subarray(0, 32);
      return cachedMasterKey;
    }

    if (isProduction) {
      throw new Error(
        "FATAL: ENCRYPTION_MASTER_KEY must be at least 32 bytes (64 hex characters) in production."
      );
    }
  }

  if (isProduction) {
    throw new Error(
      "FATAL: ENCRYPTION_MASTER_KEY environment variable is missing in production. " +
      "A 64-character hex string representing a 256-bit AES key is strictly required."
    );
  }

  // Deterministic fallback key for development / test mode with prominent warning log
  console.warn(
    "⚠️  [SECURITY WARNING] ENCRYPTION_MASTER_KEY not configured or shorter than 32 bytes. " +
    "Using deterministic development fallback key. DO NOT USE IN PRODUCTION."
  );

  cachedMasterKey = crypto
    .createHash("sha256")
    .update("talnova-dev-encryption-master-key-deterministic-v1-fallback-32b")
    .digest();

  return cachedMasterKey;
}

/**
 * Reset cached master key (internal testing helper)
 */
export function _resetMasterKeyCache(): void {
  cachedMasterKey = null;
}

/**
 * Checks whether a string conforms to the AES-256-GCM encrypted payload format
 * (versioned v1:iv:authTag:cipher or legacy iv:authTag:cipher).
 */
export function isEncryptedSecret(value?: string): boolean {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(":");
  if (parts.length === 4 && parts[0] === KEY_VERSION_V1) {
    return parts[1].length === 24 && parts[2].length === 32 && parts[3].length > 0;
  }
  if (parts.length === 3) {
    return parts[0].length === 24 && parts[1].length === 32 && parts[2].length > 0;
  }
  return false;
}

/**
 * Hashes a plaintext password using Argon2id.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
  });
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    return false;
  }
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Output format: v1:<iv>:<authTag>:<encryptedHex>
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  // Format: v1:iv:authTag:encrypted
  return `${KEY_VERSION_V1}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Supports v1 versioned payload (v1:iv:authTag:encrypted) as well as legacy (iv:authTag:encrypted).
 */
export function decryptSecret(encryptedPayload: string): string {
  if (!encryptedPayload) return "";
  const parts = encryptedPayload.split(":");

  let ivHex: string;
  let authTagHex: string;
  let encryptedHex: string;

  if (parts.length === 4 && parts[0] === KEY_VERSION_V1) {
    [, ivHex, authTagHex, encryptedHex] = parts;
  } else if (parts.length === 3) {
    [ivHex, authTagHex, encryptedHex] = parts;
  } else {
    throw new Error("Invalid encrypted payload format");
  }

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const key = getMasterKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * Safely mask an API key or credential for display
 * e.g., "sk-proj-1234567890abcdef" -> "••••••••cdef"
 */
export function maskSecret(secret?: string): string {
  if (!secret || secret.trim().length === 0) return "";
  const trimmed = secret.trim();
  if (trimmed.length <= 6) {
    return "••••••••";
  }
  const lastFour = trimmed.slice(-4);
  return `••••••••${lastFour}`;
}
