import { FastifyRequest, FastifyReply } from "fastify";
import mongoose from "mongoose";
import AppError from "../../../common/errors/app-error.js";
import { getClientIp } from "../../../common/utils/ip.util.js";
import { demoSessionService } from "../services/demo-session.service.js";
import { demoSecurityCache } from "../services/demo-security-cache.service.js";
import { getDemoActivityLogModel, getDemoRiskAlertModel } from "../models/index.js";

/**
 * Checks if the caller IP is blacklisted in the demo security cache.
 */
export async function checkDemoIpBlacklist(request: FastifyRequest, _reply: FastifyReply) {
  const ip = getClientIp(request);
  if (ip && demoSecurityCache.isIpBlacklisted(ip)) {
    const entry = demoSecurityCache.getBlacklistEntry(ip);
    throw new AppError(
      403,
      "DEMO_SECURITY_VIOLATION",
      `Access denied. Client IP is blacklisted due to automated scraping or security policy violation (${entry?.reason || "Security Lock"}).`
    );
  }
}

/**
 * Honeypot decoy endpoint handler.
 * Any client or crawler accessing these endpoints is immediately flagged, session revoked,
 * IP blacklisted, and returned 403 DEMO_SECURITY_VIOLATION.
 */
export async function demoHoneypotHandler(request: FastifyRequest, _reply: FastifyReply) {
  const ip = getClientIp(request) || "unknown";
  const url = request.url;
  const reason = `Honeypot Decoy Endpoint Triggered: ${url}`;

  // 1. Blacklist caller's IP in demo cache
  demoSecurityCache.blacklistIp(ip, reason);

  // 2. If session or user is present, terminate session immediately
  let terminatedSessionId: string | undefined;
  let tenantId: string | undefined = request.demoUser?.tenantId;
  let userId: string | undefined = request.demoUser?.id;

  if (request.demoUser?.sessionId) {
    terminatedSessionId = request.demoUser.sessionId;
    try {
      await demoSessionService.terminateSession(
        request.demoUser.sessionId,
        `Terminated due to honeypot violation on ${url}`
      );
    } catch {
      // In case session was already terminated
    }
  } else if (request.headers.authorization?.startsWith("Bearer ")) {
    // Attempt parsing token without throwing
    try {
      await (request as any).jwtVerify();
      const payload = (request as any).user;
      if (payload?.sessionId) {
        terminatedSessionId = payload.sessionId;
        tenantId = payload.demoTenantId;
        userId = payload.demoUserId;
        await demoSessionService.terminateSession(
          payload.sessionId,
          `Terminated due to honeypot violation on ${url}`
        );
      }
    } catch {
      // Non-blocking
    }
  }

  // 3. Log critical risk alert
  try {
    const DemoRiskAlert = getDemoRiskAlertModel();
    const DemoActivityLog = getDemoActivityLogModel();

    await DemoRiskAlert.create({
      demoTenantId: tenantId ? new mongoose.Types.ObjectId(tenantId) : undefined,
      demoUserId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
      alertType: "HONEYPOT_TRIGGERED",
      severity: "CRITICAL",
      status: "OPEN",
      signals: [
        `Decoy endpoint hit: ${url}`,
        `IP: ${ip}`,
        terminatedSessionId ? `Session ${terminatedSessionId} forcibly invalidated` : "Unauthenticated crawler probe",
      ],
      details: {
        url,
        ip,
        method: request.method,
        headers: {
          userAgent: request.headers["user-agent"],
          referer: request.headers.referer,
        },
        timestamp: new Date(),
      },
    });

    await DemoActivityLog.create({
      demoTenantId: request.demoUser?.tenantId,
      demoUserId: request.demoUser?.id,
      action: "HONEYPOT_TRIPPED",
      category: "SECURITY",
      description: `Automated scraper/competitor accessed decoy endpoint: ${url}. IP ${ip} blacklisted.`,
      severity: "critical",
      metadata: {
        url,
        ip,
        terminatedSessionId,
      },
    });
  } catch {
    // Non-blocking logging failure
  }

  // 4. Return formal security boundary error
  throw new AppError(
    403,
    "DEMO_SECURITY_VIOLATION",
    "Access to forbidden decoy endpoint. Demo session terminated and client IP blacklisted."
  );
}
