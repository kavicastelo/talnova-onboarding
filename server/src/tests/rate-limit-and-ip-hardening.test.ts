import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection } from "../modules/demo/database/demo-connection.js";
import { User } from "../modules/auth/models/user.model.js";
import { Organization } from "../modules/organizations/models/organization.model.js";
import { hashPassword } from "../utils/crypto.js";
import { getClientIp, isTrustedProxy, isIpv4InCidr } from "../common/utils/ip.util.js";

describe("SEC-PHASE-2: Distributed Rate Limiting & Proxy IP Hardening", () => {
  let app: FastifyInstance;
  const testOrgSlug = `rate-limit-org-${Date.now()}`;
  const testUserEmail = `rate-user-${Date.now()}@talnova.test`;
  const testPassword = "Password123!";
  let testUserId: string;
  let testOrgId: string;
  let userToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // 1. Create Organization
    const org = await Organization.create({
      name: "Rate Limit Test Org",
      slug: testOrgSlug,
      plan: "Enterprise",
      status: "Active",
      limits: { maxUsers: 50 },
      createdBy: new mongoose.Types.ObjectId(),
    });
    testOrgId = org._id.toString();

    // 2. Create User
    const hashedPassword = await hashPassword(testPassword);
    const user = await User.create({
      organizationId: org._id,
      auth: {
        email: testUserEmail,
        passwordHash: hashedPassword,
        emailVerified: true,
      },
      profile: { firstName: "Rate", lastName: "Tester", fullName: "Rate Tester" },
      permissions: { role: "admin" },
      employment: { status: "active", employmentType: "full_time" },
    });
    testUserId = user._id.toString();

    // Generate JWT for authenticated route tests
    userToken = app.jwt.sign({
      userId: testUserId,
      organizationId: testOrgId,
      role: "admin",
      tokenVersion: 1,
    });
  });

  afterAll(async () => {
    await User.deleteMany({ "auth.email": testUserEmail });
    await Organization.deleteMany({ slug: testOrgSlug });
    if (app) await app.close();
    await closeDemoConnection();
    await disconnectDatabase();
  });

  describe("1. Reverse Proxy IP Hardening & CIDR Verification", () => {
    it("correctly evaluates CIDR range inclusion with isIpv4InCidr", () => {
      // Loopback
      expect(isIpv4InCidr("127.0.0.1", "127.0.0.0/8")).toBe(true);
      expect(isIpv4InCidr("127.255.255.254", "127.0.0.0/8")).toBe(true);
      expect(isIpv4InCidr("128.0.0.1", "127.0.0.0/8")).toBe(false);

      // RFC 1918 Private
      expect(isIpv4InCidr("10.50.2.1", "10.0.0.0/8")).toBe(true);
      expect(isIpv4InCidr("172.20.10.5", "172.16.0.0/12")).toBe(true);
      expect(isIpv4InCidr("172.32.0.1", "172.16.0.0/12")).toBe(false);
      expect(isIpv4InCidr("192.168.1.1", "192.168.0.0/16")).toBe(true);
      expect(isIpv4InCidr("192.169.1.1", "192.168.0.0/16")).toBe(false);

      // Cloudflare
      expect(isIpv4InCidr("172.64.35.1", "172.64.0.0/13")).toBe(true);
      expect(isIpv4InCidr("104.16.12.3", "104.16.0.0/13")).toBe(true);
      expect(isIpv4InCidr("8.8.8.8", "104.16.0.0/13")).toBe(false);
    });

    it("identifies trusted proxies and Cloudflare edge IP ranges", () => {
      expect(isTrustedProxy("127.0.0.1")).toBe(true);
      expect(isTrustedProxy("10.0.1.20")).toBe(true);
      expect(isTrustedProxy("172.18.0.5")).toBe(true);
      expect(isTrustedProxy("192.168.0.254")).toBe(true);
      expect(isTrustedProxy("172.64.100.5")).toBe(true); // Cloudflare IP
      expect(isTrustedProxy("104.24.1.1")).toBe(true); // Cloudflare IP

      // Untrusted public client IPs
      expect(isTrustedProxy("203.0.113.195")).toBe(false);
      expect(isTrustedProxy("198.51.100.42")).toBe(false);
      expect(isTrustedProxy("8.8.8.8")).toBe(false);
    });

    it("blocks IP header spoofing when connection originates from an untrusted peer socket", () => {
      const spoofAttemptReq = {
        raw: {
          socket: {
            remoteAddress: "203.0.113.50", // Public untrusted IP directly hitting the server
          },
        },
        headers: {
          "cf-connecting-ip": "1.1.1.1", // Attacker trying to spoof Cloudflare header
          "x-real-ip": "8.8.8.8",
          "x-forwarded-for": "1.1.1.1, 8.8.8.8",
        },
      } as any;

      // Because the direct socket remoteAddress is untrusted, all headers must be rejected!
      const resolvedIp = getClientIp(spoofAttemptReq);
      expect(resolvedIp).toBe("203.0.113.50");
      expect(resolvedIp).not.toBe("1.1.1.1");
      expect(resolvedIp).not.toBe("8.8.8.8");
    });

    it("trusts and extracts cf-connecting-ip when direct socket is an authorized Cloudflare proxy", () => {
      const authorizedCfReq = {
        raw: {
          socket: {
            remoteAddress: "172.64.1.10", // Legitimate Cloudflare IP
          },
        },
        headers: {
          "cf-connecting-ip": "203.0.113.77",
          "x-forwarded-for": "203.0.113.77, 172.64.1.10",
        },
      } as any;

      const resolvedIp = getClientIp(authorizedCfReq);
      expect(resolvedIp).toBe("203.0.113.77");
    });
  });

  describe("2. Auth Rate Limiting (5 requests per 1 minute on /login)", () => {
    it("allows first 5 login attempts and blocks the 6th attempt with HTTP 429 and Retry-After header", async () => {
      // Use a dedicated client IP via X-Forwarded-For (inject runs on trusted loopback 127.0.0.1)
      const testClientIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

      const responses: any[] = [];
      for (let i = 1; i <= 6; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: {
            email: "invalid-rate-test@talnova.test",
            password: "WrongPassword999!",
          },
          headers: {
            "x-forwarded-for": testClientIp,
          },
        });
        responses.push(res);
      }

      // First 5 attempts: Handled by auth controller (rejected with 401 or 400, not 429)
      for (let i = 0; i < 5; i++) {
        expect(responses[i].statusCode).not.toBe(429);
      }

      // 6th attempt: Strictly blocked by rate limiter with 429 Too Many Requests
      const sixthRes = responses[5];
      expect(sixthRes.statusCode).toBe(429);

      // Verify standardized JSON error body
      const body = sixthRes.json();
      expect(body.success).toBe(false);
      expect(body.statusCode).toBe(429);
      expect(body.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(body.message).toContain("Rate limit exceeded");

      // Verify Retry-After header is returned
      const retryAfterHeader = sixthRes.headers["retry-after"];
      expect(retryAfterHeader).toBeDefined();
      expect(Number(retryAfterHeader)).toBeGreaterThan(0);
    });

    it("enforces rate limiting on /api/v1/auth/forgot-password", async () => {
      const forgotPasswordClientIp = `198.51.101.${Math.floor(Math.random() * 200) + 10}`;

      const responses: any[] = [];
      for (let i = 1; i <= 6; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/forgot-password",
          payload: {
            email: "test-forgot@talnova.test",
          },
          headers: {
            "x-forwarded-for": forgotPasswordClientIp,
          },
        });
        responses.push(res);
      }

      // First 5 attempts: Passed through to controller
      for (let i = 0; i < 5; i++) {
        expect(responses[i].statusCode).not.toBe(429);
      }

      // 6th attempt: Blocked with 429
      const sixthRes = responses[5];
      expect(sixthRes.statusCode).toBe(429);
      expect(sixthRes.headers["retry-after"]).toBeDefined();
    });
  });

  describe("3. Uploads Tier Rate Limiting (15 requests per 1 minute)", () => {
    it("blocks rapid requests exceeding 15 attempts on /api/v1/uploads/request-url", async () => {
      const uploadClientIp = `198.51.102.${Math.floor(Math.random() * 200) + 10}`;

      const responses: any[] = [];
      for (let i = 1; i <= 16; i++) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/uploads/request-url",
          headers: {
            authorization: `Bearer ${userToken}`,
            "x-forwarded-for": uploadClientIp,
          },
          payload: {
            fileName: `test-file-${i}.pdf`,
            fileType: "application/pdf",
            fileSize: 1024,
            category: "document",
          },
        });
        responses.push(res);
      }

      // First 15 attempts should be processed by controller (200 OK)
      for (let i = 0; i < 15; i++) {
        expect(responses[i].statusCode).not.toBe(429);
      }

      // 16th attempt must be rejected with 429
      const sixteenthRes = responses[15];
      expect(sixteenthRes.statusCode).toBe(429);
      expect(sixteenthRes.json().code).toBe("RATE_LIMIT_EXCEEDED");
      expect(sixteenthRes.headers["retry-after"]).toBeDefined();
    });
  });
});
