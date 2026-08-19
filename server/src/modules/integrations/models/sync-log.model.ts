import mongoose, { Schema, Document } from "mongoose";

export interface ISyncError {
  recordId?: string;
  email?: string;
  errorMessage: string;
  timestamp: Date;
}

export interface IDLQEvent {
  eventId: string;
  provider: string;
  payload: any;
  errorReason: string;
  retryCount: number;
  status: "pending" | "resolved" | "discarded";
  timestamp: Date;
}

export interface ISyncLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  integrationId: mongoose.Types.ObjectId;
  status: "success" | "partial" | "failed";
  processedCount: number;
  createdUsersCount: number;
  updatedUsersCount: number;
  errorCount: number;
  syncErrors: ISyncError[];
  dlqEvents: IDLQEvent[];
  durationMs: number;
  createdAt: Date;
}

const SyncErrorSchema = new Schema<ISyncError>(
  {
    recordId: { type: String },
    email: { type: String },
    errorMessage: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const DLQEventSchema = new Schema<IDLQEvent>(
  {
    eventId: { type: String, required: true },
    provider: { type: String, required: true },
    payload: { type: Schema.Types.Mixed },
    errorReason: { type: String, required: true },
    retryCount: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "resolved", "discarded"], default: "pending" },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SyncLogSchema = new Schema<ISyncLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    integrationId: { type: Schema.Types.ObjectId, required: true, ref: "HRISIntegration" },
    status: { type: String, enum: ["success", "partial", "failed"], default: "success" },
    processedCount: { type: Number, default: 0 },
    createdUsersCount: { type: Number, default: 0 },
    updatedUsersCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    syncErrors: { type: [SyncErrorSchema], default: [] },
    dlqEvents: { type: [DLQEventSchema], default: [] },
    durationMs: { type: Number, default: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

SyncLogSchema.index({ organizationId: 1, integrationId: 1, createdAt: -1 });

export const SyncLog = mongoose.model<ISyncLog>("SyncLog", SyncLogSchema);
export default SyncLog;
