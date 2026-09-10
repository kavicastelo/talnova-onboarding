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

    const staffOnly = requireRole(["owner", "admin", "manager"]);
    const adminOnly = requireRole(["owner", "admin"]);

    // Dashboard metrics & exception queue
    authApp.get("/dashboard", { preHandler: [staffOnly] }, controller.getDashboardMetrics as any);
    authApp.get("/dashboard-metrics", { preHandler: [staffOnly] }, controller.getDashboardMetrics as any);
    authApp.get("/exceptions", { preHandler: [staffOnly] }, controller.getExceptionQueue as any);

    // Handover operations - strictly Owner & Admin only
    authApp.post("/handover/:userId", { preHandler: [adminOnly] }, controller.completeHandover as any);
    authApp.post("/handover/:userId/complete", { preHandler: [adminOnly] }, controller.completeHandover as any);

    authApp.put(
      "/lifecycle/:userId/state",
      { preHandler: [adminOnly], schema: { body: updateLifecycleStateSchema } },
      controller.updateLifecycleState as any
    );
    authApp.post(
      "/bulk-action",
      { preHandler: [adminOnly], schema: { body: executeHRBulkActionSchema } },
      controller.executeBulkAction as any
    );
    authApp.get("/compliance-report", { preHandler: [staffOnly] }, controller.generateComplianceReport as any);
  });
}

export default hrOperationsRoutes;
