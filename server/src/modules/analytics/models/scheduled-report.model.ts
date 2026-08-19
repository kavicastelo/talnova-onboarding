import mongoose, { Schema, Document } from "mongoose";

export interface IScheduledReport extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  format: "csv" | "json";
  status: "active" | "paused";
  lastSentAt?: Date;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledReportSchema = new Schema<IScheduledReport>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    frequency: { type: String, enum: ["daily", "weekly", "monthly"], default: "weekly" },
    recipients: { type: [String], required: true },
    format: { type: String, enum: ["csv", "json"], default: "csv" },
    status: { type: String, enum: ["active", "paused"], default: "active" },
    lastSentAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  {
    timestamps: true,
  }
);

ScheduledReportSchema.index({ organizationId: 1, status: 1 });

export const ScheduledReport = mongoose.model<IScheduledReport>("ScheduledReport", ScheduledReportSchema);
export default ScheduledReport;
