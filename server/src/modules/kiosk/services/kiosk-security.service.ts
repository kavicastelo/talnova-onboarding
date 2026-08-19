import crypto from "crypto";

export interface PairingData {
  orgId: string;
  deviceId: string;
  expiresAt: number;
}

export class KioskSecurityService {
  // In-memory store for device pairing codes
  private pairingCodes = new Map<string, PairingData>();

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
    // 1. Check expiration (exp is Unix timestamp in seconds)
    const currentUnixTimestamp = Math.floor(Date.now() / 1000);
    if (currentUnixTimestamp > exp) {
      return false;
    }

    // 2. Generate expected signature and compare
    const expectedSig = this.generateSignature(journeyId, orgId, exp, secret);
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"));
  }

  /**
   * Generates a secure, 6-digit numeric pairing code for a physical device registration stream.
   * Codes expire after ttlMs (default 5 minutes).
   */
  generatePairingCode(orgId: string, deviceId: string, ttlMs = 300000): string {
    // Generate a 6-digit random code string
    let code: string;
    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (this.pairingCodes.has(code)); // Ensure uniqueness

    this.pairingCodes.set(code, {
      orgId,
      deviceId,
      expiresAt: Date.now() + ttlMs
    });

    return code;
  }

  /**
   * Validates a device registration code, removing it from the store upon lookup (single-use guarantee).
   */
  verifyPairingCode(code: string): PairingData | null {
    const data = this.pairingCodes.get(code);
    if (!data) {
      return null;
    }

    // Always delete after single-use validation lookup to prevent replay attacks
    this.pairingCodes.delete(code);

    if (Date.now() > data.expiresAt) {
      return null;
    }

    return data;
  }

  /**
   * Utility for testing: clears pairing codes
   */
  clearPairingCodes(): void {
    this.pairingCodes.clear();
  }
}

export default KioskSecurityService;
