import { FastifyInstance } from "fastify";
import WorkflowController from "../controllers/workflow.controller.js";
import WorkflowService from "../services/workflow.service.js";
import WorkflowRepository from "../repositories/workflow.repository.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
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

  // GET /api/v1/workflows (list rules)
  app.get("/", controller.listRules as any);

  // POST /api/v1/workflows (create rule)
  app.post("/", { schema: { body: createWorkflowRuleSchema } }, controller.createRule as any);

  // GET /api/v1/workflows/executions (list execution audit logs)
  app.get(
    "/executions",
    { schema: { querystring: getExecutionLogsQuerySchema } },
    controller.getExecutionLogs as any
  );

  // GET /api/v1/workflows/:id (get rule details)
  app.get("/:id", controller.getRule as any);

  // PATCH /api/v1/workflows/:id (update rule)
  app.patch("/:id", { schema: { body: updateWorkflowRuleSchema } }, controller.updateRule as any);

  // PATCH /api/v1/workflows/:id/toggle (enable/disable rule)
  app.patch("/:id/toggle", { schema: { body: toggleWorkflowRuleSchema } }, controller.toggleActive as any);

  // DELETE /api/v1/workflows/:id (delete rule)
  app.delete("/:id", controller.deleteRule as any);

  // POST /api/v1/workflows/:id/test-run (trigger test-run execution)
  app.post("/:id/test-run", { schema: { body: testRunWorkflowSchema } }, controller.testRun as any);
}

export default workflowRoutes;
