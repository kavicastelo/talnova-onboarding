import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import AppError from "../common/errors/app-error.js";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 1. Log the error
  const isClientError = error.statusCode && error.statusCode < 500;
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

  // 2. Handle AppError (custom operational errors)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      success: false,
      message: error.message,
      error: {
        code: error.code,
        details: error.details,
      },
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
