import mongoose, { Schema, Document } from "mongoose";

export interface IKioskWebhookSubscription extends Document {
  organizationId: mongoose.Types.ObjectId;
  url: string;
  secret: string; // Shared HMAC-SHA256 signing secret
  topics: string[]; // ["kiosk.session.completed", "kiosk.device.offline", "kiosk.device.tampered", "kiosk.emergency.activated", "*"]
  enabled: boolean;
  name?: string;
  description?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  failureCount: number;
  lastDeliveredAt?: Date;
  lastFailureAt?: Date;
  lastFailureError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KioskWebhookSubscriptionSchema = new Schema<IKioskWebhookSubscription>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Organization",
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
      trim: true,
    },
    topics: {
      type: [String],
      required: true,
      default: ["*"],
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    headers: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    lastDeliveredAt: {
      type: Date,
    },
    lastFailureAt: {
      type: Date,
    },
    lastFailureError: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

KioskWebhookSubscriptionSchema.index({ organizationId: 1, enabled: 1 });

export const KioskWebhookSubscriptionModel =
  mongoose.models.KioskWebhookSubscription ||
  mongoose.model<IKioskWebhookSubscription>(
    "KioskWebhookSubscription",
    KioskWebhookSubscriptionSchema,
    "kiosk_webhook_subscriptions"
  );

export default KioskWebhookSubscriptionModel;
