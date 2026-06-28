import { FastifyInstance } from "fastify";
import { NotificationController } from "../controllers/notification.controller.js";
import { NotificationService } from "../services/notification.service.js";
import { NotificationRepository } from "../repositories/notification.repository.js";
import { authenticate } from "../../../middleware/auth.middleware.js";
import { getNotificationsQuerySchema } from "../schemas/notification.schema.js";

export async function notificationRoutes(app: FastifyInstance) {
  const repository = new NotificationRepository();
  const service = new NotificationService(repository);
  const controller = new NotificationController(service);

  // Authenticate all routes
  app.addHook("preHandler", authenticate);

  // GET /api/v1/notifications/unread
  app.get("/unread", controller.getUnreadNotifications as any);

  // GET /api/v1/notifications/count
  app.get("/count", controller.getUnreadCount as any);

  // PATCH /api/v1/notifications/read-all
  app.patch("/read-all", controller.markAllRead as any);

  // GET /api/v1/notifications
  app.get("/", { schema: { querystring: getNotificationsQuerySchema } }, controller.listNotifications as any);

  // PATCH /api/v1/notifications/:id/read
  app.patch("/:id/read", controller.markRead as any);

  // DELETE /api/v1/notifications/:id
  app.delete("/:id", controller.deleteNotification as any);
}

export default notificationRoutes;
