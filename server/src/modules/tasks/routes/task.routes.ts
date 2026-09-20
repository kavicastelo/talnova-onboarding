import { FastifyInstance } from "fastify";
import TaskController from "../controllers/task.controller.js";
import TaskService from "../services/task.service.js";
import TaskRepository from "../repositories/task.repository.js";
import { authenticate, requireFeatureFlag } from "../../../middleware/auth.middleware.js";
import {
  createTaskSchema,
  updateTaskStatusSchema,
  addTaskCommentSchema,
  getTasksQuerySchema,
  updateHardwareMetadataSchema,
  attachHardwareReceiptSchema,
} from "../schemas/task.schema.js";

export async function taskRoutes(app: FastifyInstance) {
  const repository = new TaskRepository();
  const service = new TaskService(repository);
  const controller = new TaskController(service);
  const checkFeatureFlag = requireFeatureFlag("checklist_tasks");

  // Authenticate all routes by default except public webhook callback
  app.addHook("preHandler", async (request, reply) => {
    if (request.url.includes("/mdm/callback")) {
      return;
    }
    await authenticate(request, reply);
    await checkFeatureFlag(request, reply);
  });

  // GET /api/v1/tasks
  app.get("/", { schema: { querystring: getTasksQuerySchema } }, controller.listTasks as any);

  // POST /api/v1/tasks
  app.post("/", { schema: { body: createTaskSchema } }, controller.createTask as any);

  // GET /api/v1/tasks/:id
  app.get("/:id", controller.getTask as any);

  // PATCH /api/v1/tasks/:id/status
  app.patch("/:id/status", { schema: { body: updateTaskStatusSchema } }, controller.updateStatus as any);

  // PATCH /api/v1/tasks/:id/hardware (Prompt 08 Step 1.2)
  app.patch("/:id/hardware", { schema: { body: updateHardwareMetadataSchema } }, controller.updateHardwareMetadata as any);

  // POST /api/v1/tasks/:id/hardware/receipt (Prompt 08 Step 1.2)
  app.post("/:id/hardware/receipt", { schema: { body: attachHardwareReceiptSchema } }, controller.attachHardwareReceipt as any);

  // POST /api/v1/tasks/mdm/dispatch/:taskId (Prompt 08 Step 2.2)
  app.post("/mdm/dispatch/:taskId", controller.dispatchMdmWebhook as any);

  // POST /api/v1/tasks/mdm/callback (Prompt 08 Step 2.2 - Inbound MDM callback)
  app.post("/mdm/callback", controller.handleMdmCallback as any);

  // POST /api/v1/tasks/:id/complete (PWA offline sync alias)
  app.post("/:id/complete", controller.completeTask as any);

  // POST /api/v1/tasks/:id/comments
  app.post("/:id/comments", { schema: { body: addTaskCommentSchema } }, controller.addComment as any);

  // DELETE /api/v1/tasks/:id
  app.delete("/:id", controller.deleteTask as any);
}

export default taskRoutes;
