import mongoose, { Document, Schema } from "mongoose";

export interface IOutboxEvent extends Document {
  organizationId: mongoose.Types.ObjectId;
  aggregateType: "onboarding_case";
  aggregateId: mongoose.Types.ObjectId;
  eventName: string;
  eventVersion: number;
  correlationId: string;
  causationId?: string;
  payload: Record<string, unknown>;
  status: "pending" | "processing" | "published" | "failed";
  attempts: number;
  availableAt: Date;
  lastError?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    aggregateType: { type: String, enum: ["onboarding_case"], required: true },
    aggregateId: { type: Schema.Types.ObjectId, ref: "OnboardingCase", required: true },
    eventName: { type: String, required: true },
    eventVersion: { type: Number, required: true, default: 1 },
    correlationId: { type: String, required: true },
    causationId: { type: String },
    payload: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "processing", "published", "failed"], default: "pending" },
    attempts: { type: Number, default: 0 },
    availableAt: { type: Date, default: Date.now },
    lastError: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

OutboxEventSchema.index({ status: 1, availableAt: 1 });
OutboxEventSchema.index({ aggregateId: 1, eventName: 1, correlationId: 1 }, { unique: true });

export const OutboxEvent = mongoose.model<IOutboxEvent>("OutboxEvent", OutboxEventSchema, "outbox_events");
export default OutboxEvent;
