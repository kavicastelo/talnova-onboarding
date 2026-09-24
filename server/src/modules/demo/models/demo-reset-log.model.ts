import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoResetLog extends Document {
  performedBy: string;
  actorRole: string;
  status: "SUCCESS" | "FAILED";
  durationMs: number;
  stepsCompleted: string[];
  seedStats: {
    tenantsCreated: number;
    usersCreated: number;
    journeysCreated: number;
    tasksCreated: number;
    documentsCreated: number;
  };
  errorMessage?: string;
  createdAt: Date;
}

const DemoResetLogSchema = new Schema<IDemoResetLog>(
  {
    performedBy: { type: String, required: true },
    actorRole: { type: String, default: "super_admin" },
    status: { type: String, enum: ["SUCCESS", "FAILED"], required: true },
    durationMs: { type: Number, default: 0 },
    stepsCompleted: { type: [String], default: [] },
    seedStats: {
      tenantsCreated: { type: Number, default: 0 },
      usersCreated: { type: Number, default: 0 },
      journeysCreated: { type: Number, default: 0 },
      tasksCreated: { type: Number, default: 0 },
      documentsCreated: { type: Number, default: 0 },
    },
    errorMessage: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DemoResetLogSchema.index({ createdAt: -1 });

export function getDemoResetLogModel(): mongoose.Model<IDemoResetLog> {
  const conn = getDemoConnection();
  if (conn.models.DemoResetLog) {
    return conn.models.DemoResetLog as mongoose.Model<IDemoResetLog>;
  }
  return conn.model<IDemoResetLog>("DemoResetLog", DemoResetLogSchema);
}
