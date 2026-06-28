import { FastifyReply, FastifyRequest } from "fastify";
import { NotificationService } from "../services/notification.service.js";

export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  listNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter: Record<string, any> = {
      organizationId: user.organizationId,
      recipientUserId: user.userId,
    };

    if (query.isRead !== undefined) {
      filter.isRead = query.isRead === "true";
    }

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };

    const result = await this.service.listNotifications(filter as any, pagination);

    return reply.status(200).send({
      success: true,
      message: "Notifications list retrieved successfully",
      data: result.notifications,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getUnreadNotifications = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const query = request.query as any;

    const filter = {
      organizationId: user.organizationId,
      recipientUserId: user.userId,
      isRead: false,
    };

    const pagination = {
      page: query.page ? parseInt(query.page, 10) : 1,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
    };

    const result = await this.service.listNotifications(filter as any, pagination);

    return reply.status(200).send({
      success: true,
      message: "Unread notifications list retrieved successfully",
      data: result.notifications,
      meta: {
        total: result.total,
        page: pagination.page,
        limit: pagination.limit,
      },
    });
  };

  getUnreadCount = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const count = await this.service.getUnreadCount(user.userId);

    return reply.status(200).send({
      success: true,
      message: "Unread notification count retrieved successfully",
      data: { count },
    });
  };

  markRead = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    const notification = await this.service.markNotificationRead(params.id, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Notification marked as read successfully",
      data: notification,
    });
  };

  markAllRead = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    await this.service.markAllRead(user.userId);

    return reply.status(200).send({
      success: true,
      message: "All notifications marked as read successfully",
      data: null,
    });
  };

  deleteNotification = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as any;
    const params = request.params as any;

    await this.service.deleteNotification(params.id, user.userId);

    return reply.status(200).send({
      success: true,
      message: "Notification deleted successfully",
      data: null,
    });
  };
}

export default NotificationController;
