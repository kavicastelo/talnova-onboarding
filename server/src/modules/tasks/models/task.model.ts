import mongoose, { Schema, Document } from "mongoose";

export interface ITaskComment {
  _id?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  comment: string;
  createdAt: Date;
}

export interface ITaskStatusHistory {
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  note?: string;
}

export interface ITask extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId?: mongoose.Types.ObjectId; // Target employee being onboarded
  assignedToUserId: mongoose.Types.ObjectId; // Responsible person executing the task (cross-person)
  createdBy: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
  stage: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
  priority: "low" | "normal" | "high" | "critical";
  status: "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
  dueDate?: Date;
  relativeOffsetDays?: number;
  prerequisiteTaskIds: mongoose.Types.ObjectId[];
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  comments: ITaskComment[];
  statusHistory: ITaskStatusHistory[];
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
      enum: ["pending", "in_progress", "completed", "overdue", "cancelled"],
      default: "pending",
    },
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
          enum: ["pending", "in_progress", "completed", "overdue", "cancelled"],
          required: true,
        },
        changedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        changedAt: { type: Date, default: Date.now },
        note: { type: String },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
TaskSchema.index({ organizationId: 1 });
TaskSchema.index({ assignedToUserId: 1 });
TaskSchema.index({ employeeId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ dueDate: 1 });
TaskSchema.index({ stage: 1 });
TaskSchema.index({ isDeleted: 1 });

// Compound Indexes
TaskSchema.index({ organizationId: 1, assignedToUserId: 1, status: 1 });
TaskSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
TaskSchema.index({ organizationId: 1, status: 1, dueDate: 1 });

export const Task = mongoose.model<ITask>("Task", TaskSchema, "tasks");
export default Task;
