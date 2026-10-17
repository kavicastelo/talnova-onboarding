import { FastifyRequest, FastifyReply } from "fastify";
import AppError from "../../../common/errors/app-error.js";
import { getClientIp } from "../../../common/utils/ip.util.js";
import { getDemoActivityLogModel } from "../models/index.js";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const DEMO_RATE_LIMIT_MAX = 40; // Max 40 requests per minute
const DEMO_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window

export function resetDemoRateLimits(): void {
  rateLimitBuckets.clear();
}

/**
 * Fastify preHandler hook enforcing rate limiting on demo API requests.
 * Throttles rapid sequential crawlers and scrapers, returning HTTP 429 TOO_MANY_REQUESTS.
 */
export async function demoRateLimiter(request: FastifyRequest, reply: FastifyReply) {
  // Use session ID if authenticated, else client IP
  const identifier = request.demoUser?.sessionId || getClientIp(request) || "anonymous";
  const now = Date.now();

  let bucket = rateLimitBuckets.get(identifier);
  if (!bucket || now > bucket.resetAt) {
    bucket = {
      count: 0,
      resetAt: now + DEMO_RATE_LIMIT_WINDOW_MS,
    };
    rateLimitBuckets.set(identifier, bucket);
  }

  bucket.count += 1;

  const remaining = Math.max(0, DEMO_RATE_LIMIT_MAX - bucket.count);
  const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);

  // Attach standard rate limit headers
  reply.header("x-ratelimit-limit", String(DEMO_RATE_LIMIT_MAX));
  reply.header("x-ratelimit-remaining", String(remaining));
  reply.header("x-ratelimit-reset", String(resetSeconds));

  if (bucket.count > DEMO_RATE_LIMIT_MAX) {
    // Log suspicious scraping burst
    try {
      const DemoActivityLog = getDemoActivityLogModel();
      await DemoActivityLog.create({
        demoTenantId: request.demoUser?.tenantId,
        demoUserId: request.demoUser?.id,
        action: "RATE_LIMIT_EXCEEDED",
        category: "SECURITY",
        description: `Rapid scraping detected: ${bucket.count} requests within 1m window (max ${DEMO_RATE_LIMIT_MAX}).`,
        severity: "warning",
        metadata: {
          identifier,
          requestCount: bucket.count,
          url: request.url,
          method: request.method,
        },
      });
    } catch {
      // Non-blocking log failure
    }

    reply.header("Retry-After", resetSeconds);
    throw new AppError(
      429,
      "TOO_MANY_REQUESTS",
      `Demo API request rate limit exceeded (max ${DEMO_RATE_LIMIT_MAX} requests/minute). Automated scraping is prohibited.`
    );
  }
}
