import { describe, it, expect, beforeAll, afterAll } from "vitest";
import crypto from "crypto";
import mongoose from "mongoose";
import {
  encryptSecret,
  decryptSecret,
  maskSecret,
  isEncryptedSecret,
  getMasterKey,
  _resetMasterKeyCache,
} from "../utils/crypto.js";
import { jwtConfig, securityConfig, appConfig } from "../config/index.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";
import { SSOService } from "../modules/auth/services/sso.service.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";

describe("SEC-CRYPTO: Master Encryption Key Separation & Field-Level Data Encryption", () => {
  const originalEnvMasterKey = process.env.ENCRYPTION_MASTER_KEY;
  const originalSecurityKey = securityConfig.encryptionMasterKey;
  const originalJwtSecret = jwtConfig.secret;
  const originalCookieSecret = jwtConfig.cookieSecret;

  let testOrgId: mongoose.Types.ObjectId;
  let testUserId: mongoose.Types.ObjectId;
  let ssoService: SSOService;

  beforeAll(async () => {
    await connectDatabase();
    ssoService = new SSOService();

    testOrgId = new mongoose.Types.ObjectId();
    testUserId = new mongoose.Types.ObjectId();

    await Organization.create({
      _id: testOrgId,
      name: "Crypto Test Org",
      slug: `crypto-test-org-${Date.now()}`,
      status: "Active",
      plan: "Enterprise",
      createdBy: testUserId,
    });
  });

  afterAll(async () => {
    // Restore original configuration
    process.env.ENCRYPTION_MASTER_KEY = originalEnvMasterKey;
    securityConfig.encryptionMasterKey = originalSecurityKey;
    jwtConfig.secret = originalJwtSecret;
    jwtConfig.cookieSecret = originalCookieSecret;
    _resetMasterKeyCache();

    // Cleanup DB records
    await SSOConfig.deleteMany({ organizationId: testOrgId });
    await Organization.findByIdAndDelete(testOrgId);

    await closeDemoConnection();
    await disconnectDatabase();
  });

  // =========================================================================
  // 1. KEY SEPARATION & VERSIONED AES-256-GCM CIPHERTEXT FORMAT
  // =========================================================================
  describe("1. Key Separation & Versioned Format (v1:<iv>:<authTag>:<encryptedHex>)", () => {
    it("encrypts a secret and prefixes with key version metadata v1", () => {
      const plaintext = "sk-proj-talnova-live-integration-api-key-987654321";
      const encrypted = encryptSecret(plaintext);

      expect(typeof encrypted).toBe("string");
      expect(isEncryptedSecret(encrypted)).toBe(true);

      const parts = encrypted.split(":");
      expect(parts.length).toBe(4);
      expect(parts[0]).toBe("v1"); // Key version prefix
      expect(parts[1].length).toBe(24); // 12-byte IV = 24 hex chars
      expect(parts[2].length).toBe(32); // 16-byte AuthTag = 32 hex chars
      expect(parts[3].length).toBeGreaterThan(0); // Ciphertext hex
    });

    it("decrypts a v1 versioned secret accurately back to plaintext", () => {
      const secret = "production-oauth2-client-secret-XYZ-123456789";
      const encrypted = encryptSecret(secret);
      const decrypted = decryptSecret(encrypted);

      expect(decrypted).toBe(secret);
    });

    it("supports legacy unversioned payloads (iv:authTag:encryptedHex) for backwards compatibility", () => {
      const secret = "legacy-stored-secret-999";
      const key = getMasterKey();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      let enc = cipher.update(secret, "utf8", "hex");
      enc += cipher.final("hex");
      const tag = cipher.getAuthTag();

      // Legacy 3-part format
      const legacyPayload = `${iv.toString("hex")}:${tag.toString("hex")}:${enc}`;
      expect(legacyPayload.split(":").length).toBe(3);

      const decrypted = decryptSecret(legacyPayload);
      expect(decrypted).toBe(secret);
    });

    it("verifies that tampering with ciphertext causes an authentication tag failure", () => {
      const secret = "confidential-saml-signing-key";
      const encrypted = encryptSecret(secret);
      const parts = encrypted.split(":");

      // Flip the last character in the ciphertext hex
      const cipherHex = parts[3];
      const tamperedChar = cipherHex.endsWith("a") ? "b" : "a";
      const tamperedCipher = cipherHex.slice(0, -1) + tamperedChar;
      const tamperedPayload = `v1:${parts[1]}:${parts[2]}:${tamperedCipher}`;

      expect(() => decryptSecret(tamperedPayload)).toThrow();
    });

    it("verifies that tampering with the auth tag causes authentication failure", () => {
      const secret = "confidential-auth-tag-validation";
      const encrypted = encryptSecret(secret);
      const parts = encrypted.split(":");

      // Tamper with the authTag
      const tagHex = parts[2];
      const tamperedChar = tagHex.endsWith("0") ? "1" : "0";
      const tamperedTag = tagHex.slice(0, -1) + tamperedChar;
      const tamperedPayload = `v1:${parts[1]}:${tamperedTag}:${parts[3]}`;

      expect(() => decryptSecret(tamperedPayload)).toThrow();
    });

    it("verifies that modifying the IV causes authentication failure", () => {
      const secret = "confidential-iv-validation";
      const encrypted = encryptSecret(secret);
      const parts = encrypted.split(":");

      // Tamper with the IV
      const ivHex = parts[1];
      const tamperedChar = ivHex.endsWith("f") ? "e" : "f";
      const tamperedIv = ivHex.slice(0, -1) + tamperedChar;
      const tamperedPayload = `v1:${tamperedIv}:${parts[2]}:${parts[3]}`;

      expect(() => decryptSecret(tamperedPayload)).toThrow();
    });
  });

  // =========================================================================
  // 2. CRYPTOGRAPHIC ISOLATION FROM JWT AND COOKIE SECRETS
  // =========================================================================
  describe("2. Cryptographic Isolation from JWT and Cookie Secrets", () => {
    it("ensures rotating JWT secret and COOKIE secret does not break or alter data decryption", () => {
      const sensitiveToken = "idp-client-secret-must-survive-jwt-rotation";
      const encrypted = encryptSecret(sensitiveToken);

      // Rotate JWT secret and COOKIE secret completely
      jwtConfig.secret = "completely-new-rotated-jwt-secret-phase-5-" + Date.now();
      jwtConfig.cookieSecret = "completely-new-rotated-cookie-secret-phase-5-" + Date.now();

      // Attempt to decrypt previously encrypted ciphertext
      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(sensitiveToken);

      // Encrypt new data with rotated JWT secret active
      const secondSecret = "second-secret-after-jwt-rotation";
      const secondEncrypted = encryptSecret(secondSecret);
      expect(decryptSecret(secondEncrypted)).toBe(secondSecret);
    });

    it("throws a fatal error in production mode if ENCRYPTION_MASTER_KEY is missing or invalid", () => {
      const originalIsProd = appConfig.isProduction;
      const currentKey = securityConfig.encryptionMasterKey;

      try {
        (appConfig as any).isProduction = true;
        securityConfig.encryptionMasterKey = "";
        delete process.env.ENCRYPTION_MASTER_KEY;
        _resetMasterKeyCache();

        expect(() => getMasterKey()).toThrow(/FATAL: ENCRYPTION_MASTER_KEY/i);
      } finally {
        (appConfig as any).isProduction = originalIsProd;
        securityConfig.encryptionMasterKey = currentKey;
        process.env.ENCRYPTION_MASTER_KEY = currentKey;
        _resetMasterKeyCache();
      }
    });
  });

  // =========================================================================
  // 3. FIELD-LEVEL DATA ENCRYPTION FOR SSO CREDENTIALS
  // =========================================================================
  describe("3. Field-Level Encryption for SSO Credentials", () => {
    const rawClientSecret = "okta-live-client-secret-1234567890abcdef";
    const rawCertPem = "-----BEGIN CERTIFICATE-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0\n-----END CERTIFICATE-----";

    it("saveSSOConfig encrypts clientSecret and certificate before writing to MongoDB", async () => {
      const payload = {
        provider: "okta",
        domains: ["cryptocorp.com"],
        issuerUrl: "https://cryptocorp.okta.com",
        clientId: "0oatestclient123",
        clientSecret: rawClientSecret,
        certificate: rawCertPem,
        ssoUrl: "https://cryptocorp.okta.com/app/sso",
        status: "active",
      };

      const result = await ssoService.saveSSOConfig(testOrgId, testUserId, payload);

      // Verify returned client response masks clientSecret
      expect(result.clientSecret).toBe(maskSecret(rawClientSecret));
      expect(result.clientSecret).toContain("••••••••");
      expect(result.clientSecret).not.toContain(rawClientSecret);

      // Verify raw MongoDB document has AES-256-GCM encrypted values
      const rawDoc = await SSOConfig.findOne({ organizationId: testOrgId });
      expect(rawDoc).not.toBeNull();

      // Directly inspect the raw un-getter'd values
      const storedSecret = rawDoc?.get("clientSecret", null, { getters: false });
      const storedCert = rawDoc?.get("certificate", null, { getters: false });

      expect(isEncryptedSecret(storedSecret)).toBe(true);
      expect(storedSecret).toContain("v1:");
      expect(storedSecret).not.toContain(rawClientSecret);

      expect(isEncryptedSecret(storedCert)).toBe(true);
      expect(storedCert).toContain("v1:");
      expect(storedCert).not.toContain("BEGIN CERTIFICATE");
    });

    it("never returns decrypted clientSecret to frontend consumers in getSSOConfig; returns maskSecret()", async () => {
      const config = await ssoService.getSSOConfig(testOrgId);

      expect(config).not.toBeNull();
      expect(config.clientSecret).toBe(maskSecret(rawClientSecret));
      expect(config.clientSecret).toBe("••••••••cdef");
      expect(config.clientSecret).not.toBe(rawClientSecret);
    });

    it("retains existing encrypted secret when frontend submits masked representation", async () => {
      // Frontend submits update to domain without changing clientSecret (submitting masked value)
      const updatePayload = {
        domains: ["cryptocorp.com", "crypto-subsidiary.com"],
        clientSecret: "••••••••cdef",
      };

      const updated = await ssoService.saveSSOConfig(testOrgId, testUserId, updatePayload);
      expect(updated.domains).toContain("crypto-subsidiary.com");

      // Verify that underlying secret in DB was NOT corrupted by the mask
      const rawDoc = await SSOConfig.findOne({ organizationId: testOrgId });
      expect(rawDoc?.getDecryptedClientSecret()).toBe(rawClientSecret);
    });

    it("getDecryptedSSOCredentials accurately decrypts secrets strictly for IdP authentication handshakes", async () => {
      const idpCredentials = await ssoService.getDecryptedSSOCredentials(testOrgId);

      expect(idpCredentials).not.toBeNull();
      expect(idpCredentials?.clientSecret).toBe(rawClientSecret);
      expect(idpCredentials?.certificate).toContain("BEGIN CERTIFICATE");
      expect(idpCredentials?.clientId).toBe("0oatestclient123");
    });
  });
});
