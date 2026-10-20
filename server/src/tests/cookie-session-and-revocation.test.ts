import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Session from "../modules/auth/models/session.model.js";
import { hashPassword } from "../utils/crypto.js";
import { appConfig } from "../config/index.js";
import SessionBlocklistCache from "../infrastructure/cache/session-blocklist.cache.js";

describe("SEC-PHASE-3: Secure HttpOnly Cookie Session Architecture Test Suite", () => {
  let app: FastifyInstance;
  let testOrgId: string;
  let testUserId: string;
  let testSessionId: string;
  const testEmail = "sec-cookie-user@talnova.io";
  const testPassword = "CookieSessionPassword2026!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // Create test organization
    const org = await Organization.create({
      name: "Cookie Session Test Org",
      slug: `cookie-org-${Date.now()}`,
      status: "Active",
      createdBy: dummyId,
    });
    testOrgId = org._id.toString();

    // Create test user
    const passwordHash = await hashPassword(testPassword);
    const user = await User.create({
      organizationId: org._id,
      auth: {
        email: testEmail,
        passwordHash,
        emailVerified: true,
      },
      profile: {
        firstName: "Cookie",
        lastName: "Tester",
        fullName: "Cookie Tester",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "admin",
        roles: ["admin"],
      },
    });
    testUserId = user._id.toString();
  });

  afterAll(async () => {
    await Session.deleteMany({ userId: testUserId });
    await User.deleteMany({ organizationId: testOrgId });
    await Organization.deleteMany({ _id: testOrgId });
    SessionBlocklistCache.clear();
    await disconnectDatabase(app.log);
    await app.close();
  });

  // =========================================================================
  // 1. COOKIE ATTRIBUTES ON LOGIN, REGISTER, & REFRESH (PRODUCTION MODE)
  // =========================================================================
  describe("1. Secure Cookie Attributes (HttpOnly, SameSite=Strict, Secure)", () => {
    it("POST /api/v1/auth/login issues HttpOnly, SameSite=Strict, Secure cookies in production mode", async () => {
      const origProd = appConfig.isProduction;
      (appConfig as any).isProduction = true;

      try {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: {
            identifier: testEmail,
            password: testPassword,
          },
        });

        expect(res.statusCode).toBe(200);

        const cookies = res.cookies;
        expect(cookies).toBeDefined();

        const refreshTokenCookie = cookies.find((c: any) => c.name === "refreshToken");
        const accessTokenCookie = cookies.find((c: any) => c.name === "accessToken");

        expect(refreshTokenCookie).toBeDefined();
        expect(refreshTokenCookie?.httpOnly).toBe(true);
        expect(refreshTokenCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(refreshTokenCookie?.secure).toBe(true);
        expect(refreshTokenCookie?.path).toBe("/api/v1/auth");

        expect(accessTokenCookie).toBeDefined();
        expect(accessTokenCookie?.httpOnly).toBe(true);
        expect(accessTokenCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(accessTokenCookie?.secure).toBe(true);
        expect(accessTokenCookie?.path).toBe("/");
      } finally {
        (appConfig as any).isProduction = origProd;
      }
    });

    it("POST /api/v1/auth/register issues HttpOnly, SameSite=Strict, Secure cookies without hardcoded secure:false", async () => {
      const origProd = appConfig.isProduction;
      (appConfig as any).isProduction = true;

      const randomSuffix = Math.floor(Math.random() * 100000);
      try {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/auth/register",
          payload: {
            orgName: `Sec Cookie Org ${randomSuffix}`,
            orgSlug: `sec-cookie-slug-${randomSuffix}`,
            firstName: "Reg",
            lastName: "Tester",
            email: `reg-cookie-${randomSuffix}@talnova.io`,
            password: "RegistrationSecurePass2026!",
          },
        });

        expect(res.statusCode).toBe(201);

        const cookies = res.cookies;
        const refreshTokenCookie = cookies.find((c: any) => c.name === "refreshToken");
        const accessTokenCookie = cookies.find((c: any) => c.name === "accessToken");

        expect(refreshTokenCookie).toBeDefined();
        expect(refreshTokenCookie?.httpOnly).toBe(true);
        expect(refreshTokenCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(refreshTokenCookie?.secure).toBe(true); // Verifies hardcoded secure:false bug was resolved
        expect(refreshTokenCookie?.path).toBe("/api/v1/auth");

        expect(accessTokenCookie).toBeDefined();
        expect(accessTokenCookie?.httpOnly).toBe(true);
        expect(accessTokenCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(accessTokenCookie?.secure).toBe(true);
        expect(accessTokenCookie?.path).toBe("/");

        // Cleanup registered org and user
        const parsed = JSON.parse(res.body);
        if (parsed.data?.organization?.id) {
          await Organization.findByIdAndDelete(parsed.data.organization.id);
          await User.deleteMany({ organizationId: parsed.data.organization.id });
        }
      } finally {
        (appConfig as any).isProduction = origProd;
      }
    });

    it("POST /api/v1/auth/refresh rotates both refreshToken and accessToken cookies with Secure and HttpOnly flags", async () => {
      const origProd = appConfig.isProduction;
      (appConfig as any).isProduction = true;

      try {
        // Step 1: Login to get a valid refresh cookie
        const loginRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          payload: {
            identifier: testEmail,
            password: testPassword,
          },
        });
        expect(loginRes.statusCode).toBe(200);

        const loginCookies = loginRes.cookies;
        const refreshCookie = loginCookies.find((c: any) => c.name === "refreshToken");
        expect(refreshCookie).toBeDefined();

        // Step 2: Call /refresh with the cookie
        const refreshRes = await app.inject({
          method: "POST",
          url: "/api/v1/auth/refresh",
          headers: {
            cookie: `refreshToken=${refreshCookie.value}`,
          },
        });

        expect(refreshRes.statusCode).toBe(200);

        const newCookies = refreshRes.cookies;
        const newRefreshCookie = newCookies.find((c: any) => c.name === "refreshToken");
        const newAccessCookie = newCookies.find((c: any) => c.name === "accessToken");

        expect(newRefreshCookie).toBeDefined();
        expect(newRefreshCookie?.httpOnly).toBe(true);
        expect(newRefreshCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(newRefreshCookie?.secure).toBe(true);

        expect(newAccessCookie).toBeDefined();
        expect(newAccessCookie?.httpOnly).toBe(true);
        expect(newAccessCookie?.sameSite?.toLowerCase()).toBe("strict");
        expect(newAccessCookie?.secure).toBe(true);
      } finally {
        (appConfig as any).isProduction = origProd;
      }
    });
  });

  // =========================================================================
  // 2. DUAL TRANSPORT AUTHENTICATION IN AUTH MIDDLEWARE
  // =========================================================================
  describe("2. Dual Transport Authentication Support", () => {
    it("authenticates successfully via Authorization: Bearer <token> header", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          identifier: testEmail,
          password: testPassword,
        },
      });
      const { accessToken } = JSON.parse(loginRes.body).data;

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.user.email).toBe(testEmail);
    });

    it("authenticates successfully via HttpOnly accessToken cookie without Authorization header", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          identifier: testEmail,
          password: testPassword,
        },
      });
      const accessCookie = loginRes.cookies.find((c: any) => c.name === "accessToken");
      expect(accessCookie).toBeDefined();

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          // No Authorization header provided!
          cookie: `accessToken=${accessCookie.value}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.user.email).toBe(testEmail);
    });

    it("rejects request with 401 when neither Authorization header nor accessToken cookie is provided", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // 3. DISTRIBUTED SESSION REVOCATION BLOCKLIST
  // =========================================================================
  describe("3. Distributed Session Revocation Blocklist", () => {
    it("POST /api/v1/auth/logout revokes session in blocklist and clears cookies", async () => {
      // Step 1: Login
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          identifier: testEmail,
          password: testPassword,
        },
      });
      const { accessToken } = JSON.parse(loginRes.body).data;
      const decoded: any = (app.jwt as any).decode(accessToken);
      const sessionId = decoded.sessionId;

      expect(sessionId).toBeDefined();
      const isRevokedBefore = await SessionBlocklistCache.isSessionRevoked(sessionId);
      expect(isRevokedBefore).toBe(false);

      // Step 2: Logout with the accessToken
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/logout",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(logoutRes.statusCode).toBe(200);

      // Verify cookies are cleared
      const clearedCookies = logoutRes.cookies;
      const clearedRefresh = clearedCookies.find((c: any) => c.name === "refreshToken");
      const clearedAccess = clearedCookies.find((c: any) => c.name === "accessToken");

      expect(clearedRefresh?.value).toBe("");
      expect(clearedAccess?.value).toBe("");

      // Step 3: Verify session is recorded as revoked in cache
      const isRevokedAfter = await SessionBlocklistCache.isSessionRevoked(sessionId);
      expect(isRevokedAfter).toBe(true);

      // Step 4: Subsequent request using that same access token must immediately fail with 401 SESSION_REVOKED
      const subsequentRes = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(subsequentRes.statusCode).toBe(401);
      const errBody = JSON.parse(subsequentRes.body);
      expect(errBody.code || errBody.error?.code).toBe("SESSION_REVOKED");
    });
  });

  // =========================================================================
  // 4. URL QUERY BYPASS ELIMINATION & ISOLATED PUBLIC ROUTE VERIFICATION
  // =========================================================================
  describe("4. URL Query Bypass Elimination & Assignment Route Isolation", () => {
    it("public route /api/v1/assignments/public/verify/:id is accessible without authentication", async () => {
      const dummyCertId = new mongoose.Types.ObjectId().toString();
      const res = await app.inject({
        method: "GET",
        url: `/api/v1/assignments/public/verify/${dummyCertId}`,
      });

      // Does not return 401 Unauthorized because it's explicitly public
      expect(res.statusCode).not.toBe(401);
    });

    it("protected route /api/v1/assignments/me cannot be bypassed with query string manipulation", async () => {
      // Attacker appends /public/verify to query string to attempt bypassing global authenticate
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/assignments/me?bypass=/public/verify",
      });

      // Must strictly return 401 Unauthorized
      expect(res.statusCode).toBe(401);
    });

    it("protected route /api/v1/assignments/me works normally when authenticated", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        payload: {
          identifier: testEmail,
          password: testPassword,
        },
      });
      const { accessToken } = JSON.parse(loginRes.body).data;

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/assignments/me",
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      // Should succeed (200 with assignments list)
      expect(res.statusCode).toBe(200);
    });
  });
});
