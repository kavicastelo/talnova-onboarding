import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoRiskAlert extends Document {
  demoTenantId?: mongoose.Types.ObjectId;
  demoUserId?: mongoose.Types.ObjectId;
  alertType: "CONCURRENT_SESSIONS" | "RAPID_IP_CHANGE" | "RESTRICTED_ACCESS_ATTEMPT" | "EXCESSIVE_REQUESTS";
  severity: "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED";
  signals: string[];
  details: Record<string, any>;
  resolvedBy?: string;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DemoRiskAlertSchema = new Schema<IDemoRiskAlert>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant" },
    demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser" },
    alertType: {
      type: String,
      enum: ["CONCURRENT_SESSIONS", "RAPID_IP_CHANGE", "RESTRICTED_ACCESS_ATTEMPT", "EXCESSIVE_REQUESTS"],
      required: true,
    },
    severity: {
      type: String,
      enum: ["MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["OPEN", "REVIEWED", "RESOLVED", "DISMISSED"],
      default: "OPEN",
    },
    signals: { type: [String], default: [] },
    details: { type: Schema.Types.Mixed, default: {} },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    resolutionNotes: { type: String },
  },
  { timestamps: true }
);

DemoRiskAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });

export function getDemoRiskAlertModel(): mongoose.Model<IDemoRiskAlert> {
  const conn = getDemoConnection();
  if (conn.models.DemoRiskAlert) {
    return conn.models.DemoRiskAlert as mongoose.Model<IDemoRiskAlert>;
  }
  return conn.model<IDemoRiskAlert>("DemoRiskAlert", DemoRiskAlertSchema);
}
