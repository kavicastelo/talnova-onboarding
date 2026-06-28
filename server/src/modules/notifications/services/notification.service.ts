import NotificationRepository, {
  NotificationFilter,
  PaginationOptions,
} from "../repositories/notification.repository.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  private calculateExpiration(priority: "low" | "medium" | "high" | "critical"): Date {
    const days = priority === "critical" ? 365 : 180;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  async listNotifications(filter: NotificationFilter, pagination: PaginationOptions) {
    return this.repository.find(filter, pagination);
  }

  async getUnreadCount(userId: string | mongoose.Types.ObjectId) {
    return this.repository.countUnread(userId);
  }

  async markNotificationRead(id: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const notification = await this.repository.markAsRead(id, userId);
    if (!notification) {
      throw new AppError(404, "NOT_FOUND", "Notification not found or already read");
    }
    return notification;
  }

  async markAllRead(userId: string | mongoose.Types.ObjectId) {
    return this.repository.markAllAsRead(userId);
  }

  async deleteNotification(id: string | mongoose.Types.ObjectId, userId: string | mongoose.Types.ObjectId) {
    const notification = await this.repository.delete(id, userId);
    if (!notification) {
      throw new AppError(404, "NOT_FOUND", "Notification not found");
    }
    return notification;
  }

  // General delivery channel orchestrator
  async createNotification(data: {
    organizationId: string | mongoose.Types.ObjectId;
    recipientUserId: string | mongoose.Types.ObjectId;
    type:
      | "journey_assigned"
      | "journey_due_soon"
      | "journey_overdue"
      | "journey_completed"
      | "employee_invited"
      | "announcement"
      | "knowledge_update"
      | "manager_alert"
      | "system";
    channel?: "in_app" | "email" | "push" | "webhook";
    title: string;
    message: string;
    priority?: "low" | "medium" | "high" | "critical";
    data?: any;
  }) {
    const priority = data.priority || "medium";
    const expiresAt = this.calculateExpiration(priority);
    const channel = data.channel || "in_app";

    const notificationData = {
      organizationId: new mongoose.Types.ObjectId(data.organizationId),
      recipientUserId: new mongoose.Types.ObjectId(data.recipientUserId),
      type: data.type,
      channel,
      title: data.title,
      message: data.message,
      priority,
      data: data.data
        ? {
            journeyId: data.data.journeyId ? new mongoose.Types.ObjectId(data.data.journeyId) : undefined,
            assignmentId: data.data.assignmentId ? new mongoose.Types.ObjectId(data.data.assignmentId) : undefined,
            articleId: data.data.articleId ? new mongoose.Types.ObjectId(data.data.articleId) : undefined,
            actorUserId: data.data.actorUserId ? new mongoose.Types.ObjectId(data.data.actorUserId) : undefined,
            deepLink: data.data.deepLink,
          }
        : undefined,
      status: "pending" as const,
      isRead: false,
      expiresAt,
    };

    const notification = await this.repository.create(notificationData as any);

    // Mock Email/Push dispatch logs
    if (channel === "email") {
      console.log(`[NotificationService] Sending email to user ${data.recipientUserId}: "${data.title}" - ${data.message}`);
      notification.status = "sent";
      notification.deliveredAt = new Date();
      await notification.save();
    } else {
      notification.status = "sent";
      notification.deliveredAt = new Date();
      await notification.save();
    }

    return notification;
  }

  // Shortcut triggers
  async notifyJourneyAssignment(
    orgId: string | mongoose.Types.ObjectId,
    recipientUserId: string | mongoose.Types.ObjectId,
    journeyTitle: string,
    assignmentId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId
  ) {
    return this.createNotification({
      organizationId: orgId,
      recipientUserId,
      type: "journey_assigned",
      channel: "in_app",
      title: "New Onboarding Journey Assigned",
      message: `You have been assigned to the onboarding journey: "${journeyTitle}".`,
      priority: "high",
      data: {
        journeyId,
        assignmentId,
        deepLink: `/employee/journeys/${assignmentId.toString()}`,
      },
    });
  }

  async notifyJourneyCompletion(
    orgId: string | mongoose.Types.ObjectId,
    actorUserId: string | mongoose.Types.ObjectId,
    employeeName: string,
    journeyTitle: string,
    assignmentId: string | mongoose.Types.ObjectId,
    journeyId: string | mongoose.Types.ObjectId,
    managerUserId?: string | mongoose.Types.ObjectId
  ) {
    // Notify employee
    await this.createNotification({
      organizationId: orgId,
      recipientUserId: actorUserId,
      type: "journey_completed",
      channel: "in_app",
      title: "Congratulations! Journey Completed",
      message: `You have successfully completed: "${journeyTitle}".`,
      priority: "medium",
      data: { journeyId, assignmentId },
    });

    // Notify manager if exists
    if (managerUserId) {
      await this.createNotification({
        organizationId: orgId,
        recipientUserId: managerUserId,
        type: "journey_completed",
        channel: "in_app",
        title: "Team Member Completed Journey",
        message: `${employeeName} has completed the onboarding journey: "${journeyTitle}".`,
        priority: "medium",
        data: { journeyId, assignmentId, actorUserId },
      });
    }
  }
}

export default NotificationService;
