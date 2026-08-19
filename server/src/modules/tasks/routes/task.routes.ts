import { FastifyInstance } from "fastify";
import TaskController from "../controllers/task.controller.js";
import TaskService from "../services/task.service.js";
import TaskRepository from "../repositories/task.repository.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import {
  createTaskSchema,
  updateTaskStatusSchema,
  addTaskCommentSchema,
  getTasksQuerySchema,
} from "../schemas/task.schema.js";

export async function taskRoutes(app: FastifyInstance) {
  const repository = new TaskRepository();
  const service = new TaskService(repository);
  const controller = new TaskController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/tasks
  app.get("/", { schema: { querystring: getTasksQuerySchema } }, controller.listTasks as any);

  // POST /api/v1/tasks
  app.post("/", { schema: { body: createTaskSchema } }, controller.createTask as any);

  // GET /api/v1/tasks/:id
  app.get("/:id", controller.getTask as any);

  // PATCH /api/v1/tasks/:id/status
  app.patch("/:id/status", { schema: { body: updateTaskStatusSchema } }, controller.updateStatus as any);

  // POST /api/v1/tasks/:id/comments
  app.post("/:id/comments", { schema: { body: addTaskCommentSchema } }, controller.addComment as any);

  // DELETE /api/v1/tasks/:id
  app.delete("/:id", controller.deleteTask as any);
}

export default taskRoutes;
