import mongoose, { Schema, Document } from "mongoose";

export interface IRoleChecklistItem {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: "it_setup" | "hr_paperwork" | "equipment" | "training" | "general";
  stage: "preboarding" | "day_1" | "week_1" | "month_1" | "custom";
  priority: "low" | "normal" | "high" | "critical";
  relativeOffsetDays: number; // e.g. 0 = Day 1, 3 = Day 3, 7 = Day 7, 30 = Month 1
  requiresVerification: boolean;
  autoVerification?: {
    enabled: boolean;
    ruleType?: "document_signed" | "quiz_passed" | "course_completed" | "form_submitted";
    linkedEntityId?: mongoose.Types.ObjectId;
    entityModel?: "DocumentTemplate" | "Course" | "Quiz";
    minScorePercent?: number;
  };
  prerequisiteItemIndex?: number;
}

export interface IRoleChecklistTemplate extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  audience: {
    roles: Array<"owner" | "admin" | "manager" | "employee" | "hr_admin" | "it_admin">;
    departmentNames?: string[];
    jobTitleNames?: string[];
    employmentTypes?: Array<"full_time" | "part_time" | "contractor" | "intern">;
    locations?: string[];
    autoAssignNewHires: boolean;
  };
  items: IRoleChecklistItem[];
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RoleChecklistItemSchema = new Schema({
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
  relativeOffsetDays: { type: Number, default: 0 },
  requiresVerification: { type: Boolean, default: false },
  autoVerification: {
    enabled: { type: Boolean, default: false },
    ruleType: {
      type: String,
      enum: ["document_signed", "quiz_passed", "course_completed", "form_submitted"],
    },
    linkedEntityId: { type: Schema.Types.ObjectId },
    entityModel: {
      type: String,
      enum: ["DocumentTemplate", "Course", "Quiz"],
    },
    minScorePercent: { type: Number },
  },
  prerequisiteItemIndex: { type: Number },
});

const RoleChecklistTemplateSchema = new Schema<IRoleChecklistTemplate>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Organization",
      index: true,
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    audience: {
      roles: {
        type: [String],
        enum: ["owner", "admin", "manager", "employee", "hr_admin", "it_admin"],
        default: ["employee"],
      },
      departmentNames: { type: [String], default: [] },
      jobTitleNames: { type: [String], default: [] },
      employmentTypes: {
        type: [String],
        enum: ["full_time", "part_time", "contractor", "intern"],
        default: [],
      },
      locations: { type: [String], default: [] },
      autoAssignNewHires: { type: Boolean, default: true },
    },
    items: { type: [RoleChecklistItemSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

RoleChecklistTemplateSchema.index({ organizationId: 1, isActive: 1, isDeleted: 1 });

export const RoleChecklistTemplate = mongoose.model<IRoleChecklistTemplate>(
  "RoleChecklistTemplate",
  RoleChecklistTemplateSchema
);

export default RoleChecklistTemplate;
