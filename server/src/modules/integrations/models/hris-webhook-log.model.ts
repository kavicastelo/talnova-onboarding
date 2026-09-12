import mongoose, { Schema, Document } from "mongoose";

export interface IHRISWebhookLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  integrationId: mongoose.Types.ObjectId;
  provider: string;
  eventId: string;
  eventType: string; // "employee.created" | "employee.updated" | "employee.terminated"
  payload: any;
  signature?: string;
  status: "received" | "processed" | "failed" | "duplicate";
  error?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HRISWebhookLogSchema = new Schema<IHRISWebhookLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    integrationId: { type: Schema.Types.ObjectId, required: true, ref: "HRISIntegration" },
    provider: { type: String, required: true, lowercase: true, trim: true },
    eventId: { type: String, required: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    payload: { type: Schema.Types.Mixed, required: true },
    signature: { type: String },
    status: {
      type: String,
      enum: ["received", "processed", "failed", "duplicate"],
      default: "received",
    },
    error: { type: String },
    processedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

HRISWebhookLogSchema.index({ organizationId: 1, provider: 1, eventId: 1 }, { unique: true });
HRISWebhookLogSchema.index({ organizationId: 1, status: 1 });

export const HRISWebhookLog =
  mongoose.models.HRISWebhookLog ||
  mongoose.model<IHRISWebhookLog>("HRISWebhookLog", HRISWebhookLogSchema);

export default HRISWebhookLog;
