import { FastifyRequest } from "fastify";

/**
 * Normalizes an IP address string:
 * - Trims whitespace
 * - Strips IPv6 prefix if IPv4-mapped (e.g. "::ffff:192.168.1.1" -> "192.168.1.1")
 * - Normalizes IPv6 loopback ("::1" or "::ffff:127.0.0.1" -> "127.0.0.1")
 */
export function normalizeIp(ip?: string | null): string {
  if (!ip) return "127.0.0.1";
  let cleanIp = ip.trim();

  if (cleanIp === "::1" || cleanIp === "::ffff:127.0.0.1") {
    return "127.0.0.1";
  }

  if (cleanIp.startsWith("::ffff:")) {
    cleanIp = cleanIp.slice(7);
  }

  return cleanIp || "127.0.0.1";
}

/**
 * Extracts the real client IP address from a request, taking into account
 * reverse proxies, Cloudflare, load balancers, and forwarded headers in order of authority:
 * 1. Cloudflare header ('cf-connecting-ip')
 * 2. True-Client-IP header (Akamai, Cloudflare Enterprise)
 * 3. Standard 'x-real-ip' header (Nginx, Caddy, HAProxy)
 * 4. Standard 'x-forwarded-for' header (extracting the leftmost, original client IP)
 * 5. Fastify's native 'request.ip' (which honors trustProxy)
 * 6. Raw socket remoteAddress fallback
 */
export function getClientIp(request: FastifyRequest): string {
  const headers = request.headers;

  // 1. Cloudflare real client IP
  const cfConnectingIp = headers["cf-connecting-ip"];
  if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
    return normalizeIp(cfConnectingIp);
  }

  // 2. True-Client-IP (Akamai, Cloudflare Enterprise)
  const trueClientIp = headers["true-client-ip"];
  if (typeof trueClientIp === "string" && trueClientIp.trim()) {
    return normalizeIp(trueClientIp);
  }

  // 3. X-Real-IP (Nginx, Caddy, HAProxy)
  const xRealIp = headers["x-real-ip"];
  if (typeof xRealIp === "string" && xRealIp.trim()) {
    return normalizeIp(xRealIp);
  }

  // 4. X-Forwarded-For (standard proxy header, comma-separated list of IPs)
  const xForwardedFor = headers["x-forwarded-for"];
  if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
    const firstIp = xForwardedFor.split(",")[0].trim();
    if (firstIp) {
      return normalizeIp(firstIp);
    }
  } else if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    const firstIp = xForwardedFor[0].split(",")[0].trim();
    if (firstIp) {
      return normalizeIp(firstIp);
    }
  }

  // 5. Fastify's request.ip (which uses trustProxy)
  if (request.ip) {
    return normalizeIp(request.ip);
  }

  // 6. Socket remote address fallback
  return normalizeIp(request.raw?.socket?.remoteAddress);
}
