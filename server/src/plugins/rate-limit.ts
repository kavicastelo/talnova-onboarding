import fastifyRateLimit from "@fastify/rate-limit";
import { FastifyInstance } from "fastify";

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: "1 minute",
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
