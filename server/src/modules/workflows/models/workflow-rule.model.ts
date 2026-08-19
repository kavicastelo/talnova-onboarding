import mongoose, { Schema, Document } from "mongoose";

export interface IWorkflowCondition {
  field: "department" | "role" | "jobTitle" | "location" | "employmentStatus";
  operator: "equals" | "not_equals" | "in" | "contains";
  value: string | string[];
}

export interface IWorkflowAction {
  type: "assign_journey" | "create_task" | "send_notification" | "trigger_buddy" | "delay";
  params: {
    journeyId?: string;
    taskTitle?: string;
    taskDescription?: string;
    taskCategory?: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
    taskStage?: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
    taskPriority?: "low" | "normal" | "high" | "critical";
    taskAssigneeRole?: "employee" | "manager" | "hr" | "it";
    notificationTitle?: string;
    notificationMessage?: string;
    notificationChannel?: "in_app" | "email";
    delayMinutes?: number;
  };
}

export interface IWorkflowRule extends Document {
  organizationId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  triggerType: "user_created" | "journey_completed" | "task_completed" | "stage_entered" | "checkin_due";
  conditions: IWorkflowCondition[];
  actions: IWorkflowAction[];
  isActive: boolean;
  version: number;
  createdBy: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkflowConditionSchema = new Schema<IWorkflowCondition>(
  {
    field: {
      type: String,
      enum: ["department", "role", "jobTitle", "location", "employmentStatus"],
      required: true,
    },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "in", "contains"],
      required: true,
    },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const WorkflowActionSchema = new Schema<IWorkflowAction>(
  {
    type: {
      type: String,
      enum: ["assign_journey", "create_task", "send_notification", "trigger_buddy", "delay"],
      required: true,
    },
    params: {
      journeyId: { type: String },
      taskTitle: { type: String },
      taskDescription: { type: String },
      taskCategory: {
        type: String,
        enum: ["it_setup", "hr_paperwork", "equipment", "training", "general"],
        default: "general",
      },
      taskStage: {
        type: String,
        enum: ["preboarding", "day_1", "week_1", "month_1", "custom"],
        default: "day_1",
      },
      taskPriority: {
        type: String,
        enum: ["low", "normal", "high", "critical"],
        default: "normal",
      },
      taskAssigneeRole: {
        type: String,
        enum: ["employee", "manager", "hr", "it"],
        default: "employee",
      },
      notificationTitle: { type: String },
      notificationMessage: { type: String },
      notificationChannel: { type: String, enum: ["in_app", "email"], default: "in_app" },
      delayMinutes: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const WorkflowRuleSchema = new Schema<IWorkflowRule>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    triggerType: {
      type: String,
      enum: ["user_created", "journey_completed", "task_completed", "stage_entered", "checkin_due"],
      required: true,
    },
    conditions: [WorkflowConditionSchema],
    actions: [WorkflowActionSchema],
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
WorkflowRuleSchema.index({ organizationId: 1, triggerType: 1, isActive: 1 });
WorkflowRuleSchema.index({ organizationId: 1, isDeleted: 1 });

export const WorkflowRule = mongoose.model<IWorkflowRule>("WorkflowRule", WorkflowRuleSchema, "workflow_rules");
export default WorkflowRule;
