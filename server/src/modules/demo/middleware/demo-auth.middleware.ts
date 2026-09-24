import { FastifyRequest, FastifyReply } from "fastify";
import AppError from "../../../common/errors/app-error.js";
import { demoSessionService } from "../services/demo-session.service.js";
import { DemoResetService } from "../services/demo-reset.service.js";

declare module "fastify" {
  interface FastifyRequest {
    demoUser?: {
      id: string;
      email: string;
      role: string;
      tenantId: string;
      sessionId: string;
      companyName?: string;
    };
  }
}

/**
 * Fastify preHandler hook ensuring the request carries a valid, active demo session.
 */
export async function demoAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
  if (DemoResetService.isResetting()) {
    throw new AppError(
      503,
      "DEMO_RESETTING",
      "The demo environment is currently undergoing an administrative reset. Please try again shortly."
    );
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(401, "UNAUTHORIZED", "Demo authentication required.");
  }

  try {
    // Verify JWT
    await request.jwtVerify();
    const payload = request.user as any;

    if (!payload || !payload.isDemo || !payload.sessionId) {
      throw new AppError(401, "INVALID_DEMO_TOKEN", "Token is not a valid demo session credential.");
    }

    // Validate active session in isolated demo database
    await demoSessionService.validateSession(payload.sessionId, request.ip);

    // Attach demo identity to request context
    request.demoUser = {
      id: payload.demoUserId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.demoTenantId,
      sessionId: payload.sessionId,
      companyName: payload.companyName,
    };
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    const isExpired = error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED";
    throw new AppError(
      401,
      isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED",
      isExpired ? "Demo session token has expired." : "Demo authentication failed."
    );
  }
}
