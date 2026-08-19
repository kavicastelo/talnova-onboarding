import mongoose, { Schema, Document } from "mongoose";

export interface IMilestoneGoal {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
}

export interface ICheckinQuestion {
  _id?: mongoose.Types.ObjectId;
  question: string;
  type: "text" | "rating" | "boolean";
  required: boolean;
}

export interface IMilestoneTemplate extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  targetDay: 30 | 60 | 90 | 180; // Milestone day milestone (Day 30, Day 60, Day 90)
  goals: IMilestoneGoal[];
  checkinQuestions: ICheckinQuestion[];
  audience: {
    departmentNames?: string[];
    jobTitleNames?: string[];
    autoAssignNewHires?: boolean;
  };
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneGoalSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
});

const CheckinQuestionSchema = new Schema({
  question: { type: String, required: true },
  type: { type: String, enum: ["text", "rating", "boolean"], default: "text" },
  required: { type: Boolean, default: true },
});

const MilestoneTemplateSchema = new Schema<IMilestoneTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    targetDay: { type: Number, enum: [30, 60, 90, 180], required: true },
    goals: { type: [MilestoneGoalSchema], default: [] },
    checkinQuestions: { type: [CheckinQuestionSchema], default: [] },
    audience: {
      departmentNames: { type: [String], default: [] },
      jobTitleNames: { type: [String], default: [] },
      autoAssignNewHires: { type: Boolean, default: true },
    },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

MilestoneTemplateSchema.index({ organizationId: 1, targetDay: 1, isDeleted: 1 });

export const MilestoneTemplate = mongoose.model<IMilestoneTemplate>("MilestoneTemplate", MilestoneTemplateSchema);
export default MilestoneTemplate;
