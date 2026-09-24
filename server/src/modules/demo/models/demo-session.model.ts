import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoSession extends Document {
  sessionId: string;
  demoUserId: mongoose.Types.ObjectId;
  demoTenantId: mongoose.Types.ObjectId;
  tokenVersion: number;
  ipAddress?: string;
  deviceInfo?: string;
  userAgent?: string;
  isValid: boolean;
  riskStatus: "NORMAL" | "SUSPICIOUS" | "HIGH_RISK" | "BLOCKED";
  suspiciousReason?: string;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DemoSessionSchema = new Schema<IDemoSession>(
  {
    sessionId: { type: String, required: true, unique: true },
    demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser", required: true },
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    tokenVersion: { type: Number, default: 1 },
    ipAddress: { type: String },
    deviceInfo: { type: String },
    userAgent: { type: String },
    isValid: { type: Boolean, default: true },
    riskStatus: {
      type: String,
      enum: ["NORMAL", "SUSPICIOUS", "HIGH_RISK", "BLOCKED"],
      default: "NORMAL",
    },
    suspiciousReason: { type: String },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

DemoSessionSchema.index({ demoUserId: 1, isValid: 1 });
DemoSessionSchema.index({ demoTenantId: 1, isValid: 1 });
DemoSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getDemoSessionModel(): mongoose.Model<IDemoSession> {
  const conn = getDemoConnection();
  if (conn.models.DemoSession) {
    return conn.models.DemoSession as mongoose.Model<IDemoSession>;
  }
  return conn.model<IDemoSession>("DemoSession", DemoSessionSchema);
}
