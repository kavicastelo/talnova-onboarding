import mongoose, { Schema, Document, Model } from "mongoose";

export type AlertCategory = "tenant" | "security" | "onboarding" | "operations" | "system";
export type AlertSeverity = "critical" | "high" | "warning" | "info";
export type AlertStatus = "open" | "acknowledged" | "investigating" | "resolved" | "ignored";

export interface IAlert extends Document {
  alertNo: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  sourceService: string;
  organizationId?: mongoose.Types.ObjectId;
  sourceId: string;
  status: AlertStatus;
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    alertNo: {
      type: String,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["tenant", "security", "onboarding", "operations", "system"],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "warning", "info"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    sourceService: {
      type: String,
      required: true,
      trim: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    sourceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["open", "acknowledged", "investigating", "resolved", "ignored"],
      default: "open",
      index: true,
    },
    acknowledgedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    acknowledgedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    resolvedAt: {
      type: Date,
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "alerts",
  }
);

// Compound indexes for fast filtering and state queries
AlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
AlertSchema.index({ sourceId: 1, status: 1 });
AlertSchema.index({ category: 1, status: 1 });

// Ensure alertNo is generated if not provided
AlertSchema.pre("validate", function (next) {
  if (!this.alertNo) {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.alertNo = `ALT-${year}-${randomSuffix}`;
  }
  next();
});

export const Alert: Model<IAlert> =
  mongoose.models.Alert || mongoose.model<IAlert>("Alert", AlertSchema);

export default Alert;
