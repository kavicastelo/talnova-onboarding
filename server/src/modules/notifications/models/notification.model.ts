import mongoose, { Schema, Document } from "mongoose";

export type NotificationType =
  | "journey_assigned"
  | "journey_due_soon"
  | "journey_overdue"
  | "journey_completed"
  | "task_assigned"
  | "task_completed"
  | "task_due_soon"
  | "task_overdue"
  | "task_verified"
  | "task_revision_requested"
  | "task_needs_review"
  | "checklist_assigned"
  | "checklist_completed"
  | "document_assigned"
  | "document_signed"
  | "document_overdue"
  | "milestone_assigned"
  | "milestone_submitted"
  | "milestone_approved"
  | "milestone_revision_requested"
  | "buddy_assigned"
  | "buddy_checklist_updated"
  | "buddy_nudge"
  | "hardware_provisioned"
  | "hardware_dispatched"
  | "hardware_received"
  | "onboarding_signed_off"
  | "employee_invited"
  | "announcement"
  | "knowledge_update"
  | "manager_alert"
  | "meeting_scheduled"
  | "meeting_cancelled"
  | "meeting_reminder"
  | "system";

export interface INotification extends Document {
  organizationId: mongoose.Types.ObjectId;
  recipientUserId: mongoose.Types.ObjectId;
  type: NotificationType;
  channel: "in_app" | "email" | "push" | "webhook";
  title: string;
  message: string;
  priority: "low" | "medium" | "high" | "critical";
  data?: {
    journeyId?: mongoose.Types.ObjectId | string;
    assignmentId?: mongoose.Types.ObjectId | string;
    taskId?: mongoose.Types.ObjectId | string;
    checklistId?: mongoose.Types.ObjectId | string;
    documentId?: mongoose.Types.ObjectId | string;
    milestoneId?: mongoose.Types.ObjectId | string;
    employeeId?: mongoose.Types.ObjectId | string;
    buddyId?: mongoose.Types.ObjectId | string;
    managerUserId?: mongoose.Types.ObjectId | string;
    articleId?: mongoose.Types.ObjectId | string;
    actorUserId?: mongoose.Types.ObjectId | string;
    eventId?: mongoose.Types.ObjectId | string;
    locationUrl?: string;
    deepLink?: string;
    [key: string]: any;
  };
  status: "pending" | "queued" | "sent" | "failed" | "cancelled";
  isRead: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  expiresAt?: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    recipientUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    type: {
      type: String,
      enum: [
        "journey_assigned",
        "journey_due_soon",
        "journey_overdue",
        "journey_completed",
        "task_assigned",
        "task_completed",
        "task_due_soon",
        "task_overdue",
        "task_verified",
        "task_revision_requested",
        "task_needs_review",
        "checklist_assigned",
        "checklist_completed",
        "document_assigned",
        "document_signed",
        "document_overdue",
        "milestone_assigned",
        "milestone_submitted",
        "milestone_approved",
        "milestone_revision_requested",
        "buddy_assigned",
        "buddy_checklist_updated",
        "buddy_nudge",
        "hardware_provisioned",
        "hardware_dispatched",
        "hardware_received",
        "onboarding_signed_off",
        "employee_invited",
        "announcement",
        "knowledge_update",
        "manager_alert",
        "meeting_scheduled",
        "meeting_cancelled",
        "meeting_reminder",
        "system",
      ],
      required: true,
    },
    channel: {
      type: String,
      enum: ["in_app", "email", "push", "webhook"],
      default: "in_app",
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    data: {
      journeyId: { type: Schema.Types.Mixed },
      assignmentId: { type: Schema.Types.Mixed },
      taskId: { type: Schema.Types.Mixed },
      checklistId: { type: Schema.Types.Mixed },
      documentId: { type: Schema.Types.Mixed },
      milestoneId: { type: Schema.Types.Mixed },
      employeeId: { type: Schema.Types.Mixed },
      buddyId: { type: Schema.Types.Mixed },
      managerUserId: { type: Schema.Types.Mixed },
      articleId: { type: Schema.Types.Mixed },
      actorUserId: { type: Schema.Types.Mixed },
      eventId: { type: Schema.Types.Mixed },
      locationUrl: { type: String },
      deepLink: { type: String },
    },
    status: {
      type: String,
      enum: ["pending", "queued", "sent", "failed", "cancelled"],
      default: "pending",
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    deliveredAt: { type: Date },
    failureReason: { type: String },
    retryCount: { type: Number, default: 0 },
    expiresAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ organizationId: 1 });
NotificationSchema.index({ recipientUserId: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ status: 1 });
NotificationSchema.index({ priority: 1 });
NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

// TTL index (automatically delete documents after expiresAt has passed)
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes
NotificationSchema.index({ recipientUserId: 1, isRead: 1 });
NotificationSchema.index({ organizationId: 1, createdAt: -1 });
NotificationSchema.index({ status: 1, retryCount: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  NotificationSchema,
  "notifications"
);

export default Notification;
