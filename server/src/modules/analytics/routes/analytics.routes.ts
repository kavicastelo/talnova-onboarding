import { FastifyInstance } from "fastify";
import { AnalyticsController } from "../controllers/analytics.controller.js";
import { AnalyticsService } from "../services/analytics.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function analyticsRoutes(app: FastifyInstance) {
  const service = new AnalyticsService();
  const controller = new AnalyticsController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);
  app.addHook("preHandler", requireRole(["owner", "admin", "manager"]));

  // GET /api/v1/analytics/summary
  app.get("/summary", controller.getSummary as any);

  // GET /api/v1/analytics/time-to-completion
  app.get("/time-to-completion", controller.getTimeToCompletion as any);

  // GET /api/v1/analytics/bottlenecks
  app.get("/bottlenecks", controller.getBottlenecks as any);

  // GET /api/v1/analytics/export
  app.get("/export", controller.exportCSV as any);

  // Scheduled Reports
  app.post("/scheduled-reports", controller.createScheduledReport as any);
  app.get("/scheduled-reports", controller.listScheduledReports as any);
  app.delete("/scheduled-reports/:id", controller.deleteScheduledReport as any);
}

export default analyticsRoutes;
