import mongoose, { Schema, Document } from "mongoose";

export interface ITaskComment {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  comment: string;
  createdAt: Date;
}

export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "verified"
  | "overdue"
  | "cancelled"
  | "needs_review"
  | "revision_requested";

export interface ITaskAutoVerification {
  enabled: boolean;
  ruleType?: "document_signed" | "quiz_passed" | "course_completed" | "form_submitted";
  linkedEntityId?: mongoose.Types.ObjectId;
  entityModel?: "DocumentTemplate" | "Course" | "Quiz";
  minScorePercent?: number;
  verifiedHash?: string;
  verificationAuditNote?: string;
  quarantineReason?: string;
}

export interface ITaskStatusHistory {
  status: TaskStatus;
  changedBy?: mongoose.Types.ObjectId | string;
  changedAt: Date;
  note?: string;
  actingRole?: string;
}

export type HardwareDeviceType =
  | "laptop"
  | "desktop"
  | "monitor"
  | "mobile"
  | "security_key"
  | "peripherals"
  | "notebook"
  | "safety_kit"
  | "uniform"
  | "tools"
  | "badge_access"
  | "other";

export type HardwareDeliveryStatus =
  | "pending_dispatch"
  | "dispatched"
  | "enrolled"
  | "delivered"
  | "failed";

export interface IHardwareMetadata {
  deviceType?: HardwareDeviceType | string;
  serialNumber?: string;
  assetTag?: string;
  courierTrackingUrl?: string;
  courierProvider?: string;
  shipDate?: Date;
  receiptAttachment?: {
    uploadId?: mongoose.Types.ObjectId;
    fileUrl?: string;
    fileName?: string;
    uploadedAt?: Date;
  };
  mdmStatus?: HardwareDeliveryStatus | string;
  mdmExternalId?: string;
  receivedConfirmedAt?: Date;
  receivedConfirmedBy?: mongoose.Types.ObjectId;
}

export interface ITask extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId; // Target employee being onboarded
  assignedToUserId: mongoose.Types.ObjectId; // Responsible person executing the task (cross-person)
  createdBy: mongoose.Types.ObjectId;
  taskCode?: string;
  title: string;
  description?: string;
  category: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
  stage: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
  priority: "low" | "normal" | "high" | "critical";
  status: TaskStatus;
  requiresVerification?: boolean;
  autoVerification?: ITaskAutoVerification;
  quarantineReason?: string;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  dueDate?: Date;
  relativeOffsetDays?: number;
  prerequisiteTaskIds: mongoose.Types.ObjectId[];
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  comments: ITaskComment[];
  statusHistory: ITaskStatusHistory[];
  hardwareMetadata?: IHardwareMetadata;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User" },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskCode: { type: String },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: {
      type: String,
      enum: ["it_setup", "hr_paperwork", "equipment", "training", "general"],
      default: "general",
    },
    stage: {
      type: String,
      enum: ["preboarding", "day_1", "week_1", "month_1", "custom"],
      default: "day_1",
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "critical"],
      default: "normal",
    },
    status: {
      type: String,
      enum: [
        "pending",
        "in_progress",
        "completed",
        "verified",
        "overdue",
        "cancelled",
        "needs_review",
        "revision_requested",
      ],
      default: "pending",
    },
    requiresVerification: { type: Boolean, default: false },
    autoVerification: {
      enabled: { type: Boolean, default: false },
      ruleType: {
        type: String,
        enum: ["document_signed", "quiz_passed", "course_completed", "form_submitted"],
      },
      linkedEntityId: { type: Schema.Types.ObjectId, refPath: "autoVerification.entityModel" },
      entityModel: { type: String, enum: ["DocumentTemplate", "Course", "Quiz"] },
      minScorePercent: { type: Number },
      verifiedHash: { type: String },
      verificationAuditNote: { type: String },
      quarantineReason: { type: String },
    },
    quarantineReason: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: { type: Date },
    relativeOffsetDays: { type: Number },
    prerequisiteTaskIds: [{ type: Schema.Types.ObjectId, ref: "Task" }],
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    comments: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        comment: { type: String, required: true, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "pending",
            "in_progress",
            "completed",
            "verified",
            "overdue",
            "cancelled",
            "needs_review",
            "revision_requested",
          ],
          required: true,
        },
        changedBy: { type: Schema.Types.Mixed },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
        actingRole: { type: String },
      },
    ],
    hardwareMetadata: {
      deviceType: {
        type: String,
        trim: true,
      },
      serialNumber: { type: String, trim: true },
      assetTag: { type: String, trim: true },
      courierTrackingUrl: { type: String, trim: true },
      courierProvider: { type: String, trim: true },
      shipDate: { type: Date },
      receiptAttachment: {
        uploadId: { type: Schema.Types.ObjectId, ref: "Upload" },
        fileUrl: { type: String },
        fileName: { type: String },
        uploadedAt: { type: Date },
      },
      mdmStatus: {
        type: String,
        default: "pending_dispatch",
      },
      mdmExternalId: { type: String },
      receivedConfirmedAt: { type: Date },
      receivedConfirmedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
TaskSchema.index({ organizationId: 1 });
TaskSchema.index({ organizationId: 1, category: 1 });
TaskSchema.index({ organizationId: 1, "hardwareMetadata.serialNumber": 1 });
TaskSchema.index({ organizationId: 1, "hardwareMetadata.assetTag": 1 });
TaskSchema.index({ organizationId: 1, taskCode: 1 });
TaskSchema.index({ assignedToUserId: 1 });
TaskSchema.index({ employeeId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ stage: 1 });
TaskSchema.index({ isDeleted: 1 });
TaskSchema.index({
  organizationId: 1,
  "autoVerification.enabled": 1,
  "autoVerification.ruleType": 1,
  "autoVerification.linkedEntityId": 1,
});

// Compound Indexes
TaskSchema.index({ organizationId: 1, assignedToUserId: 1, status: 1 });
TaskSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
TaskSchema.index({ organizationId: 1, status: 1, dueDate: 1 });

export const Task = mongoose.model<ITask>("Task", TaskSchema, "tasks");
export default Task;
