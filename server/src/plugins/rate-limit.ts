import fastifyRateLimit, { RateLimitOptions } from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";
import { Redis as IORedis } from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { getClientIp } from "../common/utils/ip.util.js";
import { config } from "../config/index.js";
import AppError from "../common/errors/app-error.js";

/**
 * Tiered Rate Limiting Presets
 */

/** Auth Tier: 5 requests per 1 minute (Login, Register, Forgot Password) */
export const authRateLimit: RateLimitOptions = {
  max: 5,
  timeWindow: "1 minute",
};

/** AI Engine Tier: 20 requests per 1 minute (/chat and /query) */
export const aiRateLimit: RateLimitOptions = {
  max: 20,
  timeWindow: "1 minute",
};

/** Uploads Tier: 15 requests per 1 minute (Presigned URLs & upload sessions) */
export const uploadRateLimit: RateLimitOptions = {
  max: 15,
  timeWindow: "1 minute",
};

/** Global Default Tier: 300 requests per 1 minute */
export const globalRateLimit: RateLimitOptions = {
  max: 300,
  timeWindow: "1 minute",
};

const UPSTASH_RATE_LIMIT_LUA = `
  local key = KEYS[1]
  local timeWindow = tonumber(ARGV[1])
  local max = tonumber(ARGV[2])
  local continueExceeding = ARGV[3] == 'true'
  local exponentialBackoff = ARGV[4] == 'true'
  local MAX_SAFE_INTEGER = (2^53) - 1

  local current = redis.call('INCR', key)

  if current == 1 or (continueExceeding and current > max) then
    redis.call('PEXPIRE', key, timeWindow)
  elseif exponentialBackoff and current > max then
    local backoffExponent = current - max - 1
    timeWindow = math.min(timeWindow * (2 ^ backoffExponent), MAX_SAFE_INTEGER)
    redis.call('PEXPIRE', key, timeWindow)
  else
    timeWindow = redis.call('PTTL', key)
  end

  return {current, timeWindow}
`;

export class UpstashRateLimitStore {
  public continueExceeding: boolean;
  public exponentialBackoff: boolean;
  public key: string;
  private client: UpstashRedis;

  constructor(options: any = {}) {
    this.continueExceeding = Boolean(options.continueExceeding);
    this.exponentialBackoff = Boolean(options.exponentialBackoff);
    this.key = options.key || "fastify-rate-limit-";

    if (options.client) {
      this.client = options.client;
    } else {
      const url = process.env.UPSTASH_REDIS_REST_URL || config.redis?.upstashRestUrl;
      const token = process.env.UPSTASH_REDIS_REST_TOKEN || config.redis?.upstashRestToken;
      this.client = new UpstashRedis({ url: url!, token: token! });
    }
  }

  public incr(
    ip: string,
    cb: (err: Error | null, result?: { current: number; ttl: number }) => void,
    timeWindow: number,
    max: number
  ): void {
    const fullKey = `${this.key}${ip}`;
    this.client
      .eval(
        UPSTASH_RATE_LIMIT_LUA,
        [fullKey],
        [
          String(timeWindow),
          String(max),
          String(this.continueExceeding),
          String(this.exponentialBackoff),
        ]
      )
      .then((res: any) => {
        cb(null, {
          current: Number(res[0]),
          ttl: Math.max(0, Number(res[1])),
        });
      })
      .catch((err: any) => {
        console.warn("⚠️ Upstash RateLimitStore error:", err.message);
        cb(err);
      });
  }

  public child(routeOptions: any): UpstashRateLimitStore {
    const routeMethod = routeOptions.routeInfo?.method || "";
    const routeUrl = routeOptions.routeInfo?.url || "";
    return new UpstashRateLimitStore({
      continueExceeding: routeOptions.continueExceeding,
      exponentialBackoff: routeOptions.exponentialBackoff,
      key: `${this.key}${routeMethod}${routeUrl}-`,
      client: this.client,
    });
  }
}

let redisClient: IORedis | null = null;

function getRedisClient(): IORedis | null {
  const redisUrl = process.env.REDIS_URL || config.redis?.url;
  if (!redisUrl) return null;

  if (!redisClient) {
    try {
      redisClient = new IORedis(redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: any) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
      });

      redisClient.on("error", (err: any) => {
        // Prevent uncaught errors if Redis temporarily blips
        console.warn("⚠️ Rate-limit Redis connection warning:", err.message);
      });
    } catch (err: any) {
      console.warn("⚠️ Could not instantiate Redis client for rate limiting:", err.message);
      redisClient = null;
    }
  }

  return redisClient;
}

export async function registerRateLimit(app: FastifyInstance) {
  const isUpstash = Boolean(
    config.redis?.isUpstash ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );

  const pluginOptions: any = {
    global: true,
    max: globalRateLimit.max,
    timeWindow: globalRateLimit.timeWindow,
    cache: 10000, // Bounded in-memory store with max 10,000 keys fallback
    skipOnError: true,
    keyGenerator: (request: any) => getClientIp(request),
    errorResponseBuilder: (request: any, context: any) => {
      const retryAfterSeconds = Math.max(1, Math.ceil((context.ttl || 1000) / 1000));
      return new AppError(
        429,
        "RATE_LIMIT_EXCEEDED",
        `Rate limit exceeded. Try again in ${context.after}.`,
        {
          statusCode: 429,
          error: "Too Many Requests",
          retryAfter: retryAfterSeconds,
          after: context.after,
          ttl: context.ttl,
          max: context.max,
        }
      );
    },
  };

  if (isUpstash) {
    try {
      const upstashUrl = process.env.UPSTASH_REDIS_REST_URL || config.redis.upstashRestUrl!;
      const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN || config.redis.upstashRestToken!;
      const testClient = new UpstashRedis({ url: upstashUrl, token: upstashToken });
      await testClient.ping();
      pluginOptions.store = UpstashRateLimitStore;
      app.log.info("🛡️ Distributed Rate Limiter activated with Upstash Redis REST backend store.");
    } catch (err: any) {
      app.log.warn({ err }, "⚠️ Upstash Redis ping failed, falling back to local LRU cache.");
    }
  } else {
    const redis = getRedisClient();
    if (redis) {
      try {
        if (redis.status === "wait") {
          await redis.connect();
        }
        pluginOptions.redis = redis;
        app.log.info("🛡️ Distributed Rate Limiter activated with Redis backend store.");
      } catch (err: any) {
        app.log.warn({ err }, "⚠️ Redis rate limiting backend unavailable, falling back to local LRU cache.");
      }
    } else {
      app.log.info("🛡️ Rate Limiter running with bounded in-memory LRU store (10,000 max keys).");
    }
  }

  await app.register(fastifyRateLimit, pluginOptions);

  app.addHook("onClose", async () => {
    if (redisClient && (redisClient.status === "ready" || redisClient.status === "connecting")) {
      await redisClient.quit().catch(() => { });
      redisClient = null;
    }
  });
}

export default registerRateLimit;

