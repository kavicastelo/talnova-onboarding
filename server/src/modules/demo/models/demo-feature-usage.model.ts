import mongoose, { Document, Model, Schema } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoFeatureUsage extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  demoUserId: mongoose.Types.ObjectId;
  userEmail: string;
  companySlug: string;
  companyName: string;
  featureKey: string;
  route: string;
  action: "view" | "click" | "toggle" | "submit" | "export" | "restricted_attempt";
  status: "ALLOWED" | "RESTRICTED" | "SIMULATED";
  durationSeconds?: number;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const DemoFeatureUsageSchema = new Schema<IDemoFeatureUsage>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true, index: true },
    demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser", required: true, index: true },
    userEmail: { type: String, required: true, index: true },
    companySlug: { type: String, required: true, index: true },
    companyName: { type: String, required: true },
    featureKey: { type: String, required: true, index: true },
    route: { type: String, required: true },
    action: {
      type: String,
      enum: ["view", "click", "toggle", "submit", "export", "restricted_attempt"],
      default: "view",
    },
    status: {
      type: String,
      enum: ["ALLOWED", "RESTRICTED", "SIMULATED"],
      default: "ALLOWED",
    },
    durationSeconds: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "demo_feature_usages",
  }
);

DemoFeatureUsageSchema.index({ featureKey: 1, action: 1 });
DemoFeatureUsageSchema.index({ companySlug: 1, createdAt: -1 });
DemoFeatureUsageSchema.index({ status: 1, createdAt: -1 });

export function getDemoFeatureUsageModel(): Model<IDemoFeatureUsage> {
  const conn = getDemoConnection();
  if (conn.models.DemoFeatureUsage) {
    return conn.models.DemoFeatureUsage as Model<IDemoFeatureUsage>;
  }
  return conn.model<IDemoFeatureUsage>("DemoFeatureUsage", DemoFeatureUsageSchema);
}
