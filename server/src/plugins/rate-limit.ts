import fastifyRateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";
import { getClientIp } from "../common/utils/ip.util.js";

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    max: process.env.NODE_ENV === "test" ? 10000 : 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => getClientIp(request),
    errorResponseBuilder: (request, context) => {
      return {
        success: false,
        message: "Too many requests.",
        error: {
          code: "RATE_LIMIT_EXCEEDED",
        },
      };
    },
  });
}

export default registerRateLimit;
