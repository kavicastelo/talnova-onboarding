import { FastifyInstance } from "fastify";
import { HROperationsController } from "../controllers/hr-operations.controller.js";
import { HROperationsService } from "../services/hr-operations.service.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  updateLifecycleStateSchema,
  executeHRBulkActionSchema,
} from "../schemas/hr-operations.schema.js";

export async function hrOperationsRoutes(app: FastifyInstance) {
  const service = new HROperationsService();
  const controller = new HROperationsController(service);

  app.register(async (authApp) => {
    authApp.addHook("preHandler", authenticate);
    authApp.addHook("preHandler", requireRole(["owner", "admin", "manager"]));

    authApp.get("/dashboard", controller.getDashboardMetrics as any);
    authApp.get("/exceptions", controller.getExceptionQueue as any);
    authApp.put(
      "/lifecycle/:userId/state",
      { schema: { body: updateLifecycleStateSchema } },
      controller.updateLifecycleState as any
    );
    authApp.post(
      "/bulk-action",
      { schema: { body: executeHRBulkActionSchema } },
      controller.executeBulkAction as any
    );
    authApp.get("/compliance-report", controller.generateComplianceReport as any);
  });
}

export default hrOperationsRoutes;
