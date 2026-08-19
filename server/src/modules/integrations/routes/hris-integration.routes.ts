import { FastifyInstance } from "fastify";
import { HRISIntegrationController } from "../controllers/hris-integration.controller.js";
import { HRISIntegrationService } from "../services/hris-integration.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";

export async function hrisIntegrationRoutes(app: FastifyInstance) {
  const service = new HRISIntegrationService();
  const controller = new HRISIntegrationController(service);

  // Public Incoming Webhook Endpoint (INT-002)
  app.post("/webhooks/:provider", controller.handleWebhook as any);

  // Protected Admin Integration Endpoints (INT-001, HRIS-002)
  app.get(
    "/",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.getIntegrations as any
  );
  app.post(
    "/",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.createIntegration as any
  );
  app.put(
    "/:id",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.updateIntegration as any
  );
  app.delete(
    "/:id",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.deleteIntegration as any
  );
  app.post(
    "/:id/test",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.testConnection as any
  );
  app.post(
    "/:id/sync",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.triggerSync as any
  );
  app.get(
    "/:id/logs",
    { preHandler: [authenticate, requireRole(["owner", "admin"])] },
    controller.getSyncLogs as any
  );
}

export default hrisIntegrationRoutes;
