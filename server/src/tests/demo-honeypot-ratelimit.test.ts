import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { buildApp } from "../app.js";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import { closeDemoConnection, waitForDemoConnection } from "../modules/demo/database/demo-connection.js";
import {
  getDemoTenantModel,
  getDemoUserModel,
  getDemoSessionModel,
  getDemoRiskAlertModel,
} from "../modules/demo/models/index.js";
import { hashPassword } from "../utils/crypto.js";
import { demoSecurityCache } from "../modules/demo/services/demo-security-cache.service.js";
import { resetDemoRateLimits } from "../modules/demo/middleware/demo-ratelimit.middleware.js";
import { packDemoPayload, unpackDemoPayloadServer } from "../modules/demo/utils/payload-shield.util.js";

describe("Demo Security — Honeypot Decoys, Bot Defense & Rate Limiting", () => {
  let app: any;
  let tenantId: mongoose.Types.ObjectId;
  let userToken: string;
  let sessionId: string;
  const pass = "SecurePass123!";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await waitForDemoConnection(app.log);

    const DemoTenant = getDemoTenantModel();
    const DemoUser = getDemoUserModel();
    const DemoSession = getDemoSessionModel();

    const tenant = await DemoTenant.create({
      name: "Bot Defense Test Corp",
      slug: `bot-corp-${Date.now()}`,
      domain: "botdefense.com",
      contactEmail: "admin@botdefense.com",
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
      allowedFeatures: ["*"],
    });
    tenantId = tenant._id as mongoose.Types.ObjectId;

    const passHash = await hashPassword(pass);
    const user = await DemoUser.create({
      demoTenantId: tenantId,
      email: `evaluator-${Date.now()}@botdefense.com`,
      fullName: "Defense Evaluator",
      role: "demo_admin",
      passwordHash: passHash,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + 86400000),
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/demo/auth/login",
      payload: {
        email: user.email,
        password: pass,
      },
    });

    const body = JSON.parse(loginRes.body);
    userToken = body.data.token;

    const initialSession = await DemoSession.findOne({ demoUserId: user._id }).sort({ createdAt: -1 });
    sessionId = initialSession!.sessionId;
  });

  afterAll(async () => {
    demoSecurityCache.clear();
    resetDemoRateLimits();
    if (app) {
      await disconnectDatabase(app.log);
    }
    await closeDemoConnection();
  });

  beforeEach(() => {
    demoSecurityCache.clear();
    resetDemoRateLimits();
  });

  describe("Payload Shielding & Scrambler", () => {
    it("packs and unpacks proprietary curricula symmetrically in memory", () => {
      const payload = {
        title: "Engineering Acceleration Track",
        modules: [{ title: "Week 1", lessonsCount: 5 }],
      };

      const shielded = packDemoPayload(payload);
      expect(shielded.__shielded).toBe(true);
      expect(typeof shielded.payload).toBe("string");

      const unpacked = unpackDemoPayloadServer(shielded.payload);
      expect(unpacked).toEqual(payload);
    });

    it("serves shielded payload on AI Course Builder generation", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/demo/ai/course-builder/generate",
        headers: {
          authorization: `Bearer ${userToken}`,
        },
        payload: {
          roleTitle: "Staff Platform Engineer",
          department: "Infrastructure",
          weeksCount: 3,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.body);
      expect(json.success).toBe(true);
      expect(json.__shielded).toBe(true);
      expect(typeof json.payload).toBe("string");

      const unpacked = unpackDemoPayloadServer(json.payload);
      expect(unpacked.title).toContain("Staff Platform Engineer");
    });
  });

  describe("Honeypot Decoy Endpoints & Auto-Revocation", () => {
    it("returns 403 DEMO_SECURITY_VIOLATION when accessing unauthenticated honeypot", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/demo/export-all-data",
        headers: {
          "x-forwarded-for": "198.51.100.1",
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.code || json.error).toBe("DEMO_SECURITY_VIOLATION");
    });

    it("invalidates active caller session and blacklists IP upon honeypot violation", async () => {
      const attackerIp = "198.51.100.2";

      // Access decoy endpoint with userToken
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/demo/internal/raw-curriculum",
        headers: {
          authorization: `Bearer ${userToken}`,
          "x-forwarded-for": attackerIp,
        },
      });

      expect(res.statusCode).toBe(403);
      const json = JSON.parse(res.body);
      expect(json.code || json.error).toBe("DEMO_SECURITY_VIOLATION");

      // Verify session was terminated in database
      const DemoSession = getDemoSessionModel();
      const session = await DemoSession.findOne({ sessionId });
      expect(session?.isValid).toBe(false);

      // Verify risk alert logged
      const DemoRiskAlert = getDemoRiskAlertModel();
      const alert = await DemoRiskAlert.findOne({
        alertType: "HONEYPOT_TRIGGERED",
      }).sort({ createdAt: -1 });
      expect(alert).toBeDefined();
      expect(alert?.severity).toBe("CRITICAL");

      // Verify subsequent request from attacker IP is blocked immediately
      const blockedRes = await app.inject({
        method: "GET",
        url: "/api/v1/demo/dashboard",
        headers: {
          "x-forwarded-for": attackerIp,
        },
      });
      expect(blockedRes.statusCode).toBe(403);
      const blockedJson = JSON.parse(blockedRes.body);
      expect(blockedJson.code || blockedJson.error).toBe("DEMO_SECURITY_VIOLATION");
      expect(blockedJson.message).toContain("blacklisted");
    });
  });

  describe("Demo API Rate Limiting & Rapid Scraping Throttle", () => {
    it("attaches rate limit headers to demo requests", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/demo/dashboard/summary",
        headers: {
          authorization: `Bearer ${userToken}`,
          "x-forwarded-for": "203.0.113.10",
        },
      });

      expect(res.headers["x-ratelimit-limit"]).toBe("40");
      expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    });

    it("throttles rapid scraping requests exceeding 40 reqs/min with HTTP 429", async () => {
      const scraperIp = "203.0.113.99";

      // Fire 40 requests
      for (let i = 0; i < 40; i++) {
        await app.inject({
          method: "GET",
          url: "/api/v1/demo/dashboard/summary",
          headers: {
            authorization: `Bearer ${userToken}`,
            "x-forwarded-for": scraperIp,
          },
        });
      }

      // 41st request must trigger HTTP 429 TOO_MANY_REQUESTS
      const overflowRes = await app.inject({
        method: "GET",
        url: "/api/v1/demo/dashboard/summary",
        headers: {
          authorization: `Bearer ${userToken}`,
          "x-forwarded-for": scraperIp,
        },
      });

      expect(overflowRes.statusCode).toBe(429);
      const body = JSON.parse(overflowRes.body);
      expect(body.code || body.error).toBe("TOO_MANY_REQUESTS");
      expect(overflowRes.headers["retry-after"]).toBeDefined();
    });
  });
});
