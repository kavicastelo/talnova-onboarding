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

      // 1. Strict exact match against configured origins
      if (corsConfig.allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      // 2. Strict origin hostname validation for legitimate company root domains
      try {
        const parsedUrl = new URL(origin);
        const hostname = parsedUrl.hostname.toLowerCase();

        // Prohibit cloud provider shared domains (e.g. *.vercel.app, *.netlify.app)
        const isCommercialCloudHost =
          hostname.endsWith(".vercel.app") ||
          hostname.endsWith(".netlify.app") ||
          hostname.endsWith(".herokuapp.com") ||
          hostname.endsWith(".onrender.com");

        if (isCommercialCloudHost) {
          return cb(new Error(`CORS: Origin ${origin} is hosted on a shared commercial platform and is not permitted.`), false);
        }

        // Permitted company domains and their subdomains
        const isOfficialTalnovaDomain =
          hostname === "talnova.io" ||
          hostname.endsWith(".talnova.io") ||
          hostname === "talnovaonboard.com" ||
          hostname.endsWith(".talnovaonboard.com");

        if (isOfficialTalnovaDomain) {
          return cb(null, true);
        }
      } catch {
        return cb(new Error(`CORS: Malformed origin ${origin}`), false);
      }

      cb(new Error(`CORS: Origin ${origin} not allowed by CORS policy`), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });
}

export default registerCors;
