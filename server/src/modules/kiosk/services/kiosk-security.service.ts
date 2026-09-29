import crypto from "crypto";
import mongoose from "mongoose";
import { KioskPairingCodeModel } from "../models/kiosk-pairing-code.model.js";
import AppError from "../../../common/errors/app-error.js";

export interface PairingData {
  orgId: string;
  deviceId: string;
  expiresAt: number;
}

export class KioskSecurityService {
  // Rate limiting map: tracks consecutive failed pairing attempts per identifier (deviceId or IP)
  private failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

  /**
   * Generates an HMAC-SHA256 signature for a secure public kiosk playback URL.
   */
  generateSignature(journeyId: string, orgId: string, exp: number, secret: string): string {
    const payload = `${journeyId}:${orgId}:${exp}`;
    return crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");
  }

  /**
   * Verifies the signature of a signed URL query payload and asserts expiration bounds.
   */
  verifySignature(journeyId: string, orgId: string, exp: number, sig: string, secret: string): boolean {
    const currentUnixTimestamp = Math.floor(Date.now() / 1000);
    if (currentUnixTimestamp > exp) {
      return false;
    }

    try {
      const expectedSig = this.generateSignature(journeyId, orgId, exp, secret);
      const sigBuf = Buffer.from(sig, "hex");
      const expBuf = Buffer.from(expectedSig, "hex");
      if (sigBuf.length !== expBuf.length || sigBuf.length === 0) {
        return false;
      }
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      return false;
    }
  }

  /**
   * Generates a cryptographically secure, 6-digit numeric pairing code (CSPRNG)
   * stored persistently in MongoDB with TTL auto-expiry index (15 minutes).
   */
  async generatePairingCode(orgId: string, deviceId?: string, ttlMs = 900000): Promise<string> {
    let code = "";
    let collisionRetries = 0;

    // Generate with CSPRNG entropy and assert uniqueness against active codes
    do {
      code = crypto.randomInt(100000, 1000000).toString();
      collisionRetries++;

      const existing = await KioskPairingCodeModel.findOne({
        code,
        consumed: false,
        expiresAt: { $gt: new Date() }
      });
      if (!existing) break;
    } while (collisionRetries < 10);

    const expiresAt = new Date(Date.now() + ttlMs);

    await KioskPairingCodeModel.create({
      code,
      organizationId: new mongoose.Types.ObjectId(orgId),
      deviceId: deviceId || undefined,
      expiresAt,
      consumed: false,
      attemptsCount: 0
    });

    return code;
  }

  /**
   * Atomically validates and consumes a device pairing code (single-use guarantee).
   * Prevents race conditions and replay attacks using atomic findOneAndUpdate.
   */
  async verifyPairingCode(code: string, identifier?: string): Promise<PairingData | null> {
    // Brute force protection: limit to 5 consecutive failed attempts
    if (identifier && this.isRateLimited(identifier)) {
      throw new AppError(
        429,
        "RATE_LIMIT_EXCEEDED",
        "Too many failed pairing attempts. Please wait 15 minutes before trying again."
      );
    }

    const record = await KioskPairingCodeModel.findOneAndUpdate(
      {
        code,
        consumed: false,
        expiresAt: { $gt: new Date() }
      },
      {
        $set: {
          consumed: true,
          consumedAt: new Date()
        },
        $inc: {
          attemptsCount: 1
        }
      },
      { new: true }
    );

    if (!record) {
      if (identifier) {
        this.recordFailedAttempt(identifier);
      }
      return null;
    }

    if (identifier) {
      this.resetFailedAttempts(identifier);
    }

    return {
      orgId: record.organizationId.toString(),
      deviceId: record.deviceId || "",
      expiresAt: record.expiresAt.getTime()
    };
  }

  /**
   * Checks if an identifier (deviceId or IP) has exceeded failed attempt threshold.
   */
  isRateLimited(identifier: string): boolean {
    const entry = this.failedAttempts.get(identifier);
    if (!entry) return false;

    // 15-minute rate limit window
    if (Date.now() - entry.lastAttempt > 15 * 60 * 1000) {
      this.failedAttempts.delete(identifier);
      return false;
    }

    return entry.count >= 5;
  }

  recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const entry = this.failedAttempts.get(identifier);
    if (!entry || now - entry.lastAttempt > 15 * 60 * 1000) {
      this.failedAttempts.set(identifier, { count: 1, lastAttempt: now });
    } else {
      entry.count += 1;
      entry.lastAttempt = now;
    }
  }

  resetFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Utility for testing: clears pairing codes in database and resets attempt tracking.
   */
  async clearPairingCodes(): Promise<void> {
    await KioskPairingCodeModel.deleteMany({});
    this.failedAttempts.clear();
  }
}

export default KioskSecurityService;
