import fastifyCors from "@fastify/cors";
import { FastifyInstance } from "fastify";
import corsConfig from "../config/cors.config.js";
import { appConfig } from "../config/index.js";

export async function registerCors(app: FastifyInstance) {
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server) or in non-production
      if (!origin || !appConfig.isProduction) {
        return cb(null, true);
      }

      const isConfigured = corsConfig.allowedOrigins.some(
        (allowed) => origin === allowed || origin.endsWith("." + allowed)
      );

      const isCloudPlatformDemo =
        origin.endsWith(".netlify.app") ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".talnova.io") ||
        origin.endsWith(".talnovaonboard.com");

      if (isConfigured || isCloudPlatformDemo) {
        return cb(null, true);
      }

      cb(new Error(`CORS: Origin ${origin} not allowed by CORS policy`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}

export default registerCors;
