import { FastifyInstance } from "fastify";
import WorkflowController from "../controllers/workflow.controller.js";
import WorkflowService from "../services/workflow.service.js";
import WorkflowRepository from "../repositories/workflow.repository.js";
import { authenticate, requireRole } from "../../../middleware/auth.middleware.js";
import {
  createWorkflowRuleSchema,
  updateWorkflowRuleSchema,
  toggleWorkflowRuleSchema,
  getExecutionLogsQuerySchema,
  testRunWorkflowSchema,
} from "../schemas/workflow.schema.js";

export async function workflowRoutes(app: FastifyInstance) {
  const repository = new WorkflowRepository();
  const service = new WorkflowService(repository);
  const controller = new WorkflowController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  const adminOnly = requireRole(["admin", "owner", "super_admin"]);

  // GET /api/v1/workflows and /api/v1/workflows/rules (list rules)
  app.get("/", controller.listRules as any);
  app.get("/rules", controller.listRules as any);

  // POST /api/v1/workflows and /api/v1/workflows/rules (create rule)
  app.post(
    "/",
    { preHandler: [adminOnly], schema: { body: createWorkflowRuleSchema } },
    controller.createRule as any
  );
  app.post(
    "/rules",
    { preHandler: [adminOnly], schema: { body: createWorkflowRuleSchema } },
    controller.createRule as any
  );

  // GET /api/v1/workflows/executions (list execution audit logs)
  app.get(
    "/executions",
    { schema: { querystring: getExecutionLogsQuerySchema } },
    controller.getExecutionLogs as any
  );

  // GET /api/v1/workflows/:id and /api/v1/workflows/rules/:id (get rule details)
  app.get("/:id", controller.getRule as any);
  app.get("/rules/:id", controller.getRule as any);

  // PATCH /api/v1/workflows/:id and /api/v1/workflows/rules/:id (update rule)
  app.patch(
    "/:id",
    { preHandler: [adminOnly], schema: { body: updateWorkflowRuleSchema } },
    controller.updateRule as any
  );
  app.patch(
    "/rules/:id",
    { preHandler: [adminOnly], schema: { body: updateWorkflowRuleSchema } },
    controller.updateRule as any
  );

  // PATCH /api/v1/workflows/:id/toggle and /api/v1/workflows/rules/:id/toggle (enable/disable rule)
  app.patch(
    "/:id/toggle",
    { preHandler: [adminOnly], schema: { body: toggleWorkflowRuleSchema } },
    controller.toggleActive as any
  );
  app.patch(
    "/rules/:id/toggle",
    { preHandler: [adminOnly], schema: { body: toggleWorkflowRuleSchema } },
    controller.toggleActive as any
  );

  // DELETE /api/v1/workflows/:id and /api/v1/workflows/rules/:id (delete rule)
  app.delete("/:id", { preHandler: [adminOnly] }, controller.deleteRule as any);
  app.delete("/rules/:id", { preHandler: [adminOnly] }, controller.deleteRule as any);

  // POST /api/v1/workflows/:id/test-run and /api/v1/workflows/rules/:id/test-run (trigger test-run execution)
  app.post("/:id/test-run", { preHandler: [adminOnly], schema: { body: testRunWorkflowSchema } }, controller.testRun as any);
  app.post("/rules/:id/test-run", { preHandler: [adminOnly], schema: { body: testRunWorkflowSchema } }, controller.testRun as any);
}

export default workflowRoutes;

