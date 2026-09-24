import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoUser extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  email: string;
  fullName: string;
  role: "demo_admin" | "demo_manager" | "demo_employee";
  passwordHash: string;
  department: string;
  jobTitle: string;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";
  expiresAt: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DemoUserSchema = new Schema<IDemoUser>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    fullName: { type: String, required: true },
    role: {
      type: String,
      enum: ["demo_admin", "demo_manager", "demo_employee"],
      default: "demo_employee",
    },
    passwordHash: { type: String, required: true },
    department: { type: String, default: "Engineering" },
    jobTitle: { type: String, default: "Software Engineer" },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED", "REVOKED", "EXPIRED"],
      default: "ACTIVE",
    },
    expiresAt: { type: Date, required: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

DemoUserSchema.index({ demoTenantId: 1, email: 1 }, { unique: true });

export function getDemoUserModel(): mongoose.Model<IDemoUser> {
  const conn = getDemoConnection();
  if (conn.models.DemoUser) {
    return conn.models.DemoUser as mongoose.Model<IDemoUser>;
  }
  return conn.model<IDemoUser>("DemoUser", DemoUserSchema);
}
