import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function analyticsRoutes(app: FastifyInstance) {
  const service = new AnalyticsService();
  const controller = new AnalyticsController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/analytics/summary
  app.get(
    "/summary",
    {
      preHandler: [requireRole(["owner", "admin", "manager"])],
    },
    controller.getSummary as any
  );
}

export default analyticsRoutes;
