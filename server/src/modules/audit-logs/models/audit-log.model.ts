import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
  organizationId: mongoose.Types.ObjectId;
  actorUserId?: mongoose.Types.ObjectId;
  actorType: "user" | "system" | "api" | "scheduler";
  eventCategory:
    | "authentication"
    | "user"
    | "journey"
    | "assignment"
    | "content"
    | "organization"
    | "security"
    | "system";
  eventType: string;
  resourceType: string;
  resourceId?: mongoose.Types.ObjectId;
  action:
    | "create"
    | "update"
    | "delete"
    | "assign"
    | "complete"
    | "archive"
    | "restore"
    | "login"
    | "logout";
  description: string;
  metadata?: {
    previousValue?: any;
    newValue?: any;
    changes?: Record<string, any>;
  };
  request?: {
    ipAddress?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
  };
  severity: "info" | "warning" | "critical";
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    actorType: {
      type: String,
      enum: ["user", "system", "api", "scheduler"],
      required: true,
    },
    eventCategory: {
      type: String,
      enum: [
        "authentication",
        "user",
        "journey",
        "assignment",
        "content",
        "organization",
        "security",
        "system",
      ],
      required: true,
    },
    eventType: { type: String, required: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId },
    action: {
      type: String,
      enum: [
        "create",
        "update",
        "delete",
        "assign",
        "complete",
        "archive",
        "restore",
        "login",
        "logout",
      ],
      required: true,
    },
    description: { type: String, required: true },
    metadata: {
      previousValue: { type: Schema.Types.Mixed },
      newValue: { type: Schema.Types.Mixed },
      changes: { type: Schema.Types.Mixed },
    },
    request: {
      ipAddress: { type: String },
      userAgent: { type: String },
      method: { type: String },
      endpoint: { type: String },
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
  },
  {
    // Audit logs are immutable; no updatedAt needed. We set custom createdAt behavior.
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes
AuditLogSchema.index({ organizationId: 1 });
AuditLogSchema.index({ actorUserId: 1 });
AuditLogSchema.index({ eventCategory: 1 });
AuditLogSchema.index({ eventType: 1 });
AuditLogSchema.index({ resourceType: 1 });
AuditLogSchema.index({ resourceId: 1 });
AuditLogSchema.index({ severity: 1 });
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 365 * 24 * 60 * 60 });

// Compound indexes
AuditLogSchema.index({ organizationId: 1, createdAt: -1 });
AuditLogSchema.index({ actorUserId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
AuditLogSchema.index({ eventCategory: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", AuditLogSchema, "auditLogs");
export default AuditLog;
