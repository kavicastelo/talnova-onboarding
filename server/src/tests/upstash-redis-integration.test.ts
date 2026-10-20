import { describe, it, expect, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";
import { Redis as UpstashRedis } from "@upstash/redis";
import { config } from "../config/index.js";
import { SessionBlocklistCache } from "../infrastructure/cache/session-blocklist.cache.js";
import { UpstashRateLimitStore } from "../plugins/rate-limit.js";
import AppError from "../common/errors/app-error.js";

describe("Upstash Redis Distributed Infrastructure Suite", () => {
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || config.redis?.upstashRestUrl;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || config.redis?.upstashRestToken;

  const upstash = new UpstashRedis({
    url: upstashUrl!,
    token: upstashToken!,
  });

  const testSessionId = `test-upstash-session-${Date.now()}`;
  const testIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;
  let app: FastifyInstance | null = null;

  afterAll(async () => {
    // Clean up test keys in Upstash Redis
    await upstash.del(`session:revoked:${testSessionId}`).catch(() => {});
    await upstash.del(`upstash-test-rl-GET/ping-${testIp}`).catch(() => {});
    SessionBlocklistCache.clear();
    if (app) {
      await app.close().catch(() => {});
    }
  });

  describe("1. Configuration & Upstash REST Connectivity", () => {
    it("correctly identifies and exports Upstash configuration", () => {
      expect(config.redis).toBeDefined();
      expect(config.redis.isUpstash).toBe(true);
      expect(config.redis.enabled).toBe(true);
      expect(config.redis.upstashRestUrl).toBeDefined();
      expect(config.redis.upstashRestToken).toBeDefined();
    });

    it("successfully connects and pings Upstash Redis via REST API", async () => {
      const pingResult = await upstash.ping();
      expect(pingResult).toBe("PONG");
    });
  });

  describe("2. Distributed Session Revocation via Upstash", () => {
    it("persists revoked session to Upstash Redis and detects revocation across instances", async () => {
      SessionBlocklistCache.clear();

      // Revoke session with 60 seconds TTL
      await SessionBlocklistCache.revokeSession(testSessionId, 60);

      // Verify directly on Upstash Redis that the key exists
      const existsInUpstash = await upstash.exists(`session:revoked:${testSessionId}`);
      expect(existsInUpstash).toBe(1);

      // Verify SessionBlocklistCache returns true
      const isRevoked = await SessionBlocklistCache.isSessionRevoked(testSessionId);
      expect(isRevoked).toBe(true);

      // Simulate a different cluster replica with empty local memory:
      SessionBlocklistCache.clear();
      const isRevokedAcrossReplica = await SessionBlocklistCache.isSessionRevoked(testSessionId);
      expect(isRevokedAcrossReplica).toBe(true);
    });

    it("returns false for non-revoked session", async () => {
      const randomSessionId = `unrevoked-session-${Date.now()}`;
      const isRevoked = await SessionBlocklistCache.isSessionRevoked(randomSessionId);
      expect(isRevoked).toBe(false);
    });
  });

  describe("3. Distributed Rate Limiting via UpstashRateLimitStore", () => {
    it("enforces atomic sliding-window rate limiting backed by Upstash Redis", async () => {
      app = Fastify({ logger: false, trustProxy: true });

      await app.register(fastifyRateLimit, {
        global: false,
        store: UpstashRateLimitStore,
        keyGenerator: (req: any) => (req.headers["x-forwarded-for"] as string) || req.ip,
        errorResponseBuilder: (_req, context) => {
          return new AppError(
            429,
            "RATE_LIMIT_EXCEEDED",
            `Rate limit exceeded. Try again in ${context.after}.`,
            {
              statusCode: 429,
              error: "Too Many Requests",
              retryAfter: Math.max(1, Math.ceil((context.ttl || 1000) / 1000)),
              after: context.after,
              ttl: context.ttl,
              max: context.max,
            }
          );
        },
      });

      // Route with 3 requests per 60 seconds limit
      app.get(
        "/ping",
        {
          config: {
            rateLimit: {
              max: 3,
              timeWindow: 60000,
            },
          },
        },
        async () => ({ status: "ok" })
      );

      await app.ready();

      const runIp = `198.51.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 10}`;
      await upstash.del(`fastify-rate-limit-GET/ping-${runIp}`).catch(() => {});

      // Send 3 allowed requests
      for (let i = 1; i <= 3; i++) {
        const res = await app.inject({
          method: "GET",
          url: "/ping",
          headers: {
            "x-forwarded-for": runIp,
          },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual({ status: "ok" });
      }

      // 4th request must be strictly rate-limited
      const limitedRes = await app.inject({
        method: "GET",
        url: "/ping",
        headers: {
          "x-forwarded-for": runIp,
        },
      });

      expect(limitedRes.statusCode).toBe(429);
      const errorBody = limitedRes.json();
      expect(errorBody.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(limitedRes.headers["retry-after"]).toBeDefined();

      await upstash.del(`fastify-rate-limit-GET/ping-${runIp}`).catch(() => {});
    });
  });
});
