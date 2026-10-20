import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { hashPassword } from "../utils/crypto.js";
import { appConfig } from "../config/index.js";

describe("SEC-PHASE-1: Remediation of Critical Vulnerabilities Test Suite", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let otherOrgId: string;
  let userToken: string;
  let testUser: any;
  const testEmail = "sec-test-user@talnova.io";
  const initialPassword = "SecureOldPassword2026!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create primary test organization
    const org = await Organization.create({
      name: "Security Remediation Primary Org",
      slug: `sec-org-${Date.now()}`,
      status: "Active",
      createdBy: dummyId,
      integrations: {
        scimToken: "valid-scim-bearer-token-12345",
      },
    });
    testOrgId = org._id.toString();

    // 2. Create secondary tenant organization (for cross-tenant tests)
    const otherOrg = await Organization.create({
      name: "Security Remediation Other Org",
      slug: `sec-other-org-${Date.now()}`,
      status: "Active",
      createdBy: dummyId,
      integrations: {
        scimToken: "other-org-scim-token-99999",
      },
    });
    otherOrgId = otherOrg._id.toString();

    // 3. Create test user
    const passwordHash = await hashPassword(initialPassword);
    testUser = await User.create({
      organizationId: org._id,
      auth: {
        email: testEmail,
        passwordHash,
        emailVerified: true,
      },
      profile: {
        firstName: "Sec",
        lastName: "Tester",
        fullName: "Sec Tester",
      },
      employment: {
        status: "active",
        badgeId: "BDG-SEC-001",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
    });

    userToken = app.jwt.sign({
      userId: testUser._id.toString(),
      organizationId: testOrgId,
      role: "admin",
    });
  });

  afterAll(async () => {
    await User.deleteMany({ organizationId: { $in: [testOrgId, otherOrgId] } });
    await Organization.deleteMany({ _id: { $in: [testOrgId, otherOrgId] } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  // =========================================================================
  // 1. CORS STRICT ORIGIN VALIDATION (SEC-001)
  // =========================================================================
  describe("1. CORS Origin Validation (SEC-001)", () => {
    it("rejects unauthorized commercial hosting platforms (.vercel.app, .netlify.app)", async () => {
      // In production mode, wildcard cloud hosting is strictly denied
      const originalIsProd = appConfig.isProduction;
      (appConfig as any).isProduction = true;

      try {
        const resVercel = await app.inject({
          method: "OPTIONS",
          url: "/api/v1/auth/login",
          headers: {
            origin: "https://malicious-attacker.vercel.app",
            "access-control-request-method": "POST",
          },
        });
        expect(resVercel.headers["access-control-allow-origin"]).toBeUndefined();

        const resNetlify = await app.inject({
          method: "OPTIONS",
          url: "/api/v1/auth/login",
          headers: {
            origin: "https://phishing-site.netlify.app",
            "access-control-request-method": "POST",
          },
        });
        expect(resNetlify.headers["access-control-allow-origin"]).toBeUndefined();
      } finally {
        (appConfig as any).isProduction = originalIsProd;
      }
    });

    it("allows official Talnova domains and configured origins", async () => {
      const resOfficial = await app.inject({
        method: "OPTIONS",
        url: "/api/v1/auth/login",
        headers: {
          origin: "https://app.talnova.io",
          "access-control-request-method": "POST",
        },
      });
      expect(resOfficial.headers["access-control-allow-origin"]).toBe("https://app.talnova.io");
      expect(resOfficial.headers["access-control-allow-credentials"]).toBe("true");
    });
  });

  // =========================================================================
  // 2. SCIM 2.0 AUTHENTICATION & MULTI-TENANT ISOLATION (SEC-002)
  // =========================================================================
  describe("2. SCIM 2.0 Authentication Enforcement (SEC-002)", () => {
    it("rejects unauthenticated requests to SCIM User endpoints with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/Users",
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe("UNAUTHORIZED");
    });

    it("rejects SCIM request attempting tenant spoofing via x-organization-id without token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/Users",
        headers: {
          "x-organization-id": testOrgId,
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("rejects invalid SCIM Bearer token with 401 UNAUTHORIZED", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/Users",
        headers: {
          authorization: "Bearer invalid-tampered-token-xyz",
        },
      });
      expect(res.statusCode).toBe(401);
    });

    it("allows SCIM request with valid Organization SCIM Bearer token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/Users",
        headers: {
          authorization: "Bearer valid-scim-bearer-token-12345",
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.schemas).toContain("urn:ietf:params:scim:api:messages:2.0:ListResponse");
    });

    it("allows SCIM discovery endpoints without authentication (RFC 7644 Section 4)", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/scim/v2/ServiceProviderConfig",
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // 3. AWS SNS WEBHOOK SSRF ELIMINATION (SEC-003)
  // =========================================================================
  describe("3. AWS SNS Webhook SSRF Elimination (SEC-003)", () => {
    it("rejects SubscriptionConfirmation targeting internal metadata or arbitrary IP with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        headers: {
          "x-amz-sns-message-type": "SubscriptionConfirmation",
        },
        payload: {
          Type: "SubscriptionConfirmation",
          SubscribeURL: "http://169.254.169.254/latest/meta-data/",
          TopicArn: "arn:aws:sns:us-east-1:123456789012:test",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("SubscribeURL");
    });

    it("rejects SubscriptionConfirmation targeting non-Amazon domains with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/webhooks/ses",
        headers: {
          "x-amz-sns-message-type": "SubscriptionConfirmation",
        },
        payload: {
          Type: "SubscriptionConfirmation",
          SubscribeURL: "https://attacker-controlled-site.com/callback",
          TopicArn: "arn:aws:sns:us-east-1:123456789012:test",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.error).toContain("official amazonaws.com SNS endpoint");
    });
  });

  // =========================================================================
  // 4. KIOSK FRONTLINE WORKER TENANT ISOLATION (SEC-004)
  // =========================================================================
  describe("4. Kiosk Frontline Worker Tenant Isolation (SEC-004)", () => {
    it("rejects cross-tenant identification attempt with 403 TENANT_MISMATCH when token belongs to Org A but queries Org B", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        headers: {
          authorization: `Bearer ${userToken}`, // Token belongs to testOrgId
        },
        payload: {
          identifier: "BDG-SEC-001",
          organizationId: otherOrgId, // Attempting to query or claim otherOrgId
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code || body.error).toBe("TENANT_MISMATCH");
    });

    it("rejects cross-tenant identification attempt via x-organization-id header with 403 TENANT_MISMATCH", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/kiosk/identify",
        headers: {
          authorization: `Bearer ${userToken}`,
          "x-organization-id": otherOrgId,
        },
        payload: {
          identifier: "BDG-SEC-001",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code || body.error).toBe("TENANT_MISMATCH");
    });
  });

  // =========================================================================
  // 5. PASSWORD CHANGE MANDATORY CURRENT PASSWORD VERIFICATION (SEC-006)
  // =========================================================================
  describe("5. Password Change Current Password Enforcement (SEC-006)", () => {
    it("rejects password change requests missing currentPassword with 422 Validation Error", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          newPassword: "NewSecretPassword2026!#",
        },
      });

      expect(res.statusCode).toBe(422);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(JSON.stringify(body)).toContain("currentPassword");
    });

    it("rejects password change requests with incorrect currentPassword with 400 INVALID_CREDENTIALS", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          currentPassword: "WrongCurrentPassword123!",
          newPassword: "NewSecretPassword2026!#",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code || body.error).toBe("INVALID_CREDENTIALS");
    });

    it("successfully changes password when valid currentPassword is provided", async () => {
      const updatedPassword = "UpdatedValidPassword2026!#";
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/auth/change-password",
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          currentPassword: initialPassword,
          newPassword: updatedPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);

      // Verify that login works with the updated password
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          email: testEmail,
          password: updatedPassword,
        },
      });
      expect(loginRes.statusCode).toBe(200);
    });
  });
});
