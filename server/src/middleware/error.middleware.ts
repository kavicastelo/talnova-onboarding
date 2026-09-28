import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import AppError from "../common/errors/app-error.js";
import SystemLogBuffer from "../infrastructure/telemetry/system-log-buffer.js";
import { AuditLog } from "../modules/audit-logs/models/audit-log.model.js";
import { getClientIp } from "../common/utils/ip.util.js";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 1. Log the error
  const statusCode = error.statusCode || 500;
  const isClientError = statusCode < 500;
  const severity = statusCode >= 500 ? "critical" : statusCode >= 400 ? "warning" : "info";

  if (isClientError) {
    request.log.warn(
      { err: error, reqId: request.id },
      `⚠️ Client Error: ${error.message}`
    );
  } else {
    request.log.error(
      { err: error, reqId: request.id },
      `💥 Server Error: ${error.message}`
    );
  }

  // 1b. Capture in-memory SystemLogBuffer & persist critical/system errors to AuditLog
  const orgId = (request as any).user?.organizationId?.toString();
  const userId = (request as any).user?.userId?.toString();
  const cleanRoute = (request.routeOptions?.url || request.url).split("?")[0];

  SystemLogBuffer.record({
    level: severity,
    source: "server",
    eventType: `HTTP_${statusCode}`,
    action: "error",
    description: `${request.method} ${cleanRoute} failed [${statusCode}]: ${error.message}`,
    organizationId: orgId,
    metadata: {
      url: request.url,
      method: request.method,
      statusCode,
      code: (error as any).code,
      clientIp: getClientIp(request),
    },
  });

  if (statusCode >= 500 || (error as any).code === "SECURITY_ALERT" || (error as any).code === "RAPID_IP_CHANGE") {
    AuditLog.create({
      organizationId: orgId,
      actorUserId: userId,
      actorType: "system",
      eventCategory: "system",
      eventType: `HTTP_${statusCode}_ERROR`,
      resourceType: "http_server",
      action: "error",
      description: `${request.method} ${cleanRoute} [${statusCode}]: ${error.message}`,
      metadata: {
        url: request.url,
        method: request.method,
        statusCode,
        code: (error as any).code,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      request: {
        ipAddress: getClientIp(request),
        userAgent: request.headers["user-agent"],
        method: request.method,
        endpoint: cleanRoute,
      },
      severity: "critical",
    }).catch(() => {});
  }

  // 2. Handle AppError (custom operational errors)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      message: error.message,
      error: error.code,
      code: error.code,
      ...(error.details && typeof error.details === "object" ? error.details : {}),
      details: error.details,
    });
  }

  // 3. Handle Zod validation errors
  if (error instanceof ZodError) {
    const details = error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
    }));
    return reply.status(422).send({
      success: false,
      message: "Validation failed",
      error: {
        code: "VALIDATION_ERROR",
        details,
      },
    });
  }

  // 4. Handle Fastify built-in request validation errors
  if (error.validation) {
    const details = error.validation.map((err) => ({
      field: err.instancePath ? err.instancePath.substring(1) : err.keyword,
      message: err.message || "Invalid value",
    }));
    return reply.status(422).send({
      success: false,
      message: "Validation failed",
      error: {
        code: "VALIDATION_ERROR",
        details,
      },
    });
  }

  // 5. Handle @fastify/jwt errors
  if (error.code && error.code.startsWith("FST_JWT_")) {
    const isExpired = error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED";
    return reply.status(401).send({
      success: false,
      message: isExpired ? "Token has expired" : "Invalid authentication token",
      error: {
        code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      },
    });
  }

  // 6. Generic Internal Server Error fallback
  return reply.status(500).send({
    success: false,
    message: "An internal server error occurred.",
    error: {
      code: "INTERNAL_SERVER_ERROR",
    },
  });
}

export default errorHandler;
