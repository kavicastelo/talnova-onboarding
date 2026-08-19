import mongoose, { Schema, Document } from "mongoose";

export interface IPushKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscription extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  endpoint: string;
  keys: IPushKeys;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushKeysSchema = new Schema<IPushKeys>(
  {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
  },
  { _id: false }
);

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    endpoint: { type: String, required: true },
    keys: { type: PushKeysSchema, required: true },
    userAgent: { type: String },
  },
  {
    timestamps: true,
  }
);

PushSubscriptionSchema.index({ organizationId: 1, userId: 1 });
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription = mongoose.model<IPushSubscription>("PushSubscription", PushSubscriptionSchema);
export default PushSubscription;
