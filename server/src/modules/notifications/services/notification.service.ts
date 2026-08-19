import NotificationRepository, {
  NotificationFilter,
  PaginationOptions,
} from "../repositories/notification.repository.js";
import NotificationPreference from "../models/notification-preference.model.js";
import AppError from "../../../common/errors/app-error.js";
import mongoose from "mongoose";
import EmailService from "../../../shared/email/email.service.js";
import User from "../../auth/models/user.model.js";

export class NotificationService {
  private emailService: EmailService;

  constructor(private readonly repository: NotificationRepository) {
    this.emailService = new EmailService();
  }

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

  async getPreferences(userId: string | mongoose.Types.ObjectId, orgId: string | mongoose.Types.ObjectId) {
    let prefs = await NotificationPreference.findOne({ userId, organizationId: orgId });
    if (!prefs) {
      prefs = await NotificationPreference.create({
        userId,
        organizationId: orgId,
        channels: { inApp: true, email: true },
        categories: {
          journeyAssigned: { inApp: true, email: true },
          journeyOverdue: { inApp: true, email: true },
          complianceDue: { inApp: true, email: true },
          announcements: { inApp: true, email: true },
          reminders: { inApp: true, email: true },
        },
        quietHours: { enabled: false },
        frequency: "immediate",
      });
    }
    return prefs;
  }

  async updatePreferences(
    userId: string | mongoose.Types.ObjectId,
    orgId: string | mongoose.Types.ObjectId,
    data: any
  ) {
    const prefs = await NotificationPreference.findOneAndUpdate(
      { userId, organizationId: orgId },
      { $set: data },
      { new: true, upsert: true }
    );
    return prefs;
  }

  // Escalation & Frequency Rules Check (REM-005)
  private async shouldSuppressNotification(
    recipientUserId: string | mongoose.Types.ObjectId,
    type: string
  ): Promise<boolean> {
    // If overdue alert, suppress if another alert of same type was sent in last 24 hrs
    if (type === "journey_overdue" || type === "journey_due_soon") {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await this.repository.find(
        {
          recipientUserId,
          type,
        },
        { page: 1, limit: 1 }
      );
      if (recent.notifications.length > 0 && recent.notifications[0].createdAt > oneDayAgo) {
        return true; // Suppress duplicate frequency
      }
    }
    return false;
  }

  // Multi-channel delivery dispatcher (REM-003, REM-005)
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
    // Check escalation & frequency throttling rules
    const suppress = await this.shouldSuppressNotification(data.recipientUserId, data.type);
    if (suppress) {
      console.log(
        `[NotificationService] Suppressed notification ${data.type} to user ${data.recipientUserId} due to frequency escalation rules.`
      );
      return null;
    }

    // Fetch user preferences
    const prefs = await this.getPreferences(data.recipientUserId, data.organizationId);

    const priority = data.priority || "medium";
    const expiresAt = this.calculateExpiration(priority);
    const channel = data.channel || "in_app";

    // Determine category key for preference check
    let categoryKey: keyof typeof prefs.categories = "reminders";
    if (data.type === "journey_assigned") categoryKey = "journeyAssigned";
    else if (data.type === "journey_overdue") categoryKey = "journeyOverdue";
    else if (data.type === "journey_due_soon") categoryKey = "complianceDue";
    else if (data.type === "announcement") categoryKey = "announcements";

    // Verify channel enabled in preferences
    const isChannelEnabled =
      channel === "email"
        ? prefs.channels.email && prefs.categories[categoryKey]?.email !== false
        : prefs.channels.inApp && prefs.categories[categoryKey]?.inApp !== false;

    if (!isChannelEnabled) {
      console.log(
        `[NotificationService] Notification ${data.type} channel ${channel} disabled in recipient preferences.`
      );
      return null;
    }

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

    // Real Email Delivery Adapter
    if (channel === "email") {
      const recipientUser = await User.findById(data.recipientUserId).select("auth.email profile.firstName");
      if (recipientUser && recipientUser.auth?.email) {
        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #4f46e5; font-family: 'Inter', sans-serif;">${data.title}</h2>
            <p>Hello ${recipientUser.profile?.firstName || ""},</p>
            <p>${data.message}</p>
            ${data.data?.deepLink ? `<div style="margin: 25px 0;"><a href="http://localhost:5173${data.data.deepLink}" style="background-color: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Details</a></div>` : ""}
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="font-size: 12px; color: #64748b;">Talnova Onboarding Platform</p>
          </div>
        `;
        const sent = await this.emailService.sendEmail(recipientUser.auth.email, data.title, html);
        notification.status = sent ? "sent" : "failed";
        if (sent) notification.deliveredAt = new Date();
        await notification.save();
      }
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
