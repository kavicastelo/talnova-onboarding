import { Notification, INotification } from "../models/notification.model.js";
import mongoose from "mongoose";

export interface NotificationFilter {
  organizationId?: string | mongoose.Types.ObjectId;
  recipientUserId: string | mongoose.Types.ObjectId;
  isRead?: boolean;
  type?: string;
  status?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export class NotificationRepository {
  async findById(id: string | mongoose.Types.ObjectId): Promise<INotification | null> {
    return Notification.findOne({ _id: id });
  }

  async findByIdAndUser(
    id: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<INotification | null> {
    return Notification.findOne({ _id: id, recipientUserId: userId });
  }

  async find(
    filter: NotificationFilter,
    pagination: PaginationOptions
  ): Promise<{ notifications: INotification[]; total: number }> {
    const query: Record<string, any> = {
      recipientUserId: new mongoose.Types.ObjectId(filter.recipientUserId),
    };

    if (filter.organizationId) {
      query.organizationId = new mongoose.Types.ObjectId(filter.organizationId);
    }
    if (filter.isRead !== undefined) {
      query.isRead = filter.isRead;
    }
    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const total = await Notification.countDocuments(query);

    const page = Math.max(1, pagination.page);
    const limit = Math.max(1, pagination.limit);
    const skip = (page - 1) * limit;

    const sortField = pagination.sortBy || "createdAt";
    const sortOrder = pagination.sortOrder === "asc" ? 1 : -1;

    const notifications = await Notification.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit);

    return { notifications, total };
  }

  async countUnread(userId: string | mongoose.Types.ObjectId): Promise<number> {
    return Notification.countDocuments({
      recipientUserId: new mongoose.Types.ObjectId(userId),
      isRead: false,
    });
  }

  async create(notificationData: Partial<INotification>): Promise<INotification> {
    const notification = new Notification(notificationData);
    return notification.save();
  }

  async bulkCreate(notificationsData: Partial<INotification>[]): Promise<INotification[]> {
    return Notification.insertMany(notificationsData) as any;
  }

  async markAsRead(
    id: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<INotification | null> {
    return Notification.findOneAndUpdate(
      { _id: id, recipientUserId: userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
          status: "sent", // finalize status
        },
      },
      { new: true }
    );
  }

  async markAllAsRead(userId: string | mongoose.Types.ObjectId): Promise<void> {
    await Notification.updateMany(
      { recipientUserId: userId, isRead: false },
      {
        $set: {
          isRead: true,
          readAt: new Date(),
        },
      }
    );
  }

  async delete(
    id: string | mongoose.Types.ObjectId,
    userId: string | mongoose.Types.ObjectId
  ): Promise<INotification | null> {
    return Notification.findOneAndDelete({ _id: id, recipientUserId: userId });
  }
}

export default NotificationRepository;
