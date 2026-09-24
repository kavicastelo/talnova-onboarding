import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoEmailLog extends Document {
  demoTenantId?: mongoose.Types.ObjectId;
  to: string;
  subject: string;
  htmlContent: string;
  sourceEvent: string;
  sentAt: Date;
}

const DemoEmailLogSchema = new Schema<IDemoEmailLog>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant" },
    to: { type: String, required: true },
    subject: { type: String, required: true },
    htmlContent: { type: String, required: true },
    sourceEvent: { type: String, default: "notification" },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: "sentAt", updatedAt: false } }
);

DemoEmailLogSchema.index({ demoTenantId: 1, sentAt: -1 });

export function getDemoEmailLogModel(): mongoose.Model<IDemoEmailLog> {
  const conn = getDemoConnection();
  if (conn.models.DemoEmailLog) {
    return conn.models.DemoEmailLog as mongoose.Model<IDemoEmailLog>;
  }
  return conn.model<IDemoEmailLog>("DemoEmailLog", DemoEmailLogSchema);
}
