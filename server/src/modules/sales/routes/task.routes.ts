import { FastifyInstance, FastifyPluginAsync } from "fastify";
import TaskController from "../controllers/task.controller.js";

export const taskRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const controller = new TaskController();

  // Calendar view grouped by day
  app.get("/calendar", controller.getCalendarTasks);

  // List tasks with status, date, linkage filters, and counters
  app.get("/", controller.getTasks);

  // Single task details
  app.get("/:id", controller.getTaskById);

  // Create task
  app.post("/", controller.createTask);

  // Update task attributes
  app.patch("/:id", controller.updateTask);

  // Quick completion endpoint
  app.patch("/:id/complete", controller.completeTask);

  // Delete task
  app.delete("/:id", controller.deleteTask);
};

export default taskRoutes;
