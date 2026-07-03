import Fastify from "fastify";
import loggerConfig from "./config/logger.config.js";
import { appConfig, storageConfig } from "./config/index.js";
import mongoose from "mongoose";

import registerHelmet from "./plugins/helmet.js";
import registerCors from "./plugins/cors.js";
import registerCookie from "./plugins/cookie.js";
import registerCompress from "./plugins/compress.js";
import registerRateLimit from "./plugins/rate-limit.js";
import registerMultipart from "./plugins/multipart.js";
import registerJwt from "./plugins/jwt.js";
import registerSwagger from "./plugins/swagger.js";

import registerRequestId from "./middleware/request-id.middleware.js";
import registerLogging from "./middleware/logging.middleware.js";
import errorHandler from "./middleware/error.middleware.js";
import setupZodValidation from "./common/validators/compiler.js";

import { authRoutes } from "./modules/auth/index.js";
import { organizationRoutes } from "./modules/organizations/index.js";
import { employeeRoutes } from "./modules/employees/index.js";
import { journeyRoutes } from "./modules/journeys/index.js";
import { assignmentRoutes } from "./modules/assignments/index.js";
import { knowledgeBaseRoutes } from "./modules/knowledge-base/index.js";
import { uploadRoutes } from "./modules/uploads/index.js";
import { notificationRoutes } from "./modules/notifications/index.js";
import { auditLogRoutes } from "./modules/audit-logs/index.js";
import { superAdminRoutes } from "./modules/super-admin/routes/super-admin.routes.js";
import { analyticsRoutes } from "./modules/analytics/index.js";
import { localizationRoutes } from "./modules/localization/index.js";

export async function buildApp() {
  const app = Fastify({
    logger: loggerConfig,
    disableRequestLogging: true, // We will use custom request/response lifecycle logging
  });

  // Register foundational plugins
  await registerHelmet(app);
  await registerCors(app);
  await registerCookie(app);
  await registerCompress(app);
  await registerRateLimit(app);
  await registerMultipart(app);
  await registerJwt(app);
  await registerSwagger(app);

  // Set custom Zod validation compiler
  setupZodValidation(app);

  // Register global middleware hooks
  registerRequestId(app);
  registerLogging(app);

  // Set global error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await app.register(authRoutes, { prefix: "/api/v1/auth" });
  await app.register(organizationRoutes, { prefix: "/api/v1/organizations" });
  await app.register(employeeRoutes, { prefix: "/api/v1/employees" });
  await app.register(employeeRoutes, { prefix: "/api/v1/users" });
  await app.register(journeyRoutes, { prefix: "/api/v1/journeys" });
  await app.register(assignmentRoutes, { prefix: "/api/v1/assignments" });
  await app.register(knowledgeBaseRoutes, { prefix: "/api/v1/knowledge-base" });
  await app.register(uploadRoutes, { prefix: "/api/v1/uploads" });
  await app.register(notificationRoutes, { prefix: "/api/v1/notifications" });
  await app.register(auditLogRoutes, { prefix: "/api/v1/audit-logs" });
  await app.register(superAdminRoutes, { prefix: "/api/v1/super-admin" });
  await app.register(analyticsRoutes, { prefix: "/api/v1/analytics" });
  await app.register(localizationRoutes, { prefix: "/api/v1/localization" });

  // Health checks
  app.get("/live", async () => {
    return { status: "alive", timestamp: new Date().toISOString() };
  });

  app.get("/ready", async (request, reply) => {
    const dbConnected = mongoose.connection.readyState === 1;
    const storageConfigured = !!(
      storageConfig.endpoint &&
      storageConfig.bucket &&
      storageConfig.accessKeyId &&
      storageConfig.secretAccessKey
    );

    const status = dbConnected && storageConfigured ? "UP" : "DOWN";
    const code = status === "UP" ? 200 : 503;

    return reply.status(code).send({
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? "connected" : "disconnected",
        storage: storageConfigured ? "configured" : "unconfigured",
      },
    });
  });

  app.get("/health", async (request, reply) => {
    const dbConnected = mongoose.connection.readyState === 1;
    if (!dbConnected) {
      return reply.status(503).send({ status: "unhealthy", database: "disconnected" });
    }
    return { status: "healthy", database: "connected" };
  });

  return app;
}

export default buildApp;
