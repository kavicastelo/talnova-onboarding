import mongoose, { Schema, Document } from "mongoose";

export interface IQuestionAnswer {
  questionId: mongoose.Types.ObjectId;
  question: string;
  answer: string;
}

export interface IEmployeeSelfCheck {
  completedAt?: Date;
  responses: IQuestionAnswer[];
  confidenceRating?: number; // 1-5 rating
  comments?: string;
}

export interface IManagerReview {
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  approvalStatus: "pending" | "approved" | "needs_action";
  performanceRating?: number; // 1-5 rating
  feedback?: string;
}

export interface IEmployeeMilestone extends Document {
  organizationId: mongoose.Types.ObjectId;
  templateId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  milestoneTitle: string;
  targetDay: 30 | 60 | 90 | 180;
  dueDate: Date;
  status: "pending" | "in_review" | "completed" | "overdue";
  goalsProgress: Array<{
    goalTitle: string;
    completed: boolean;
    completedAt?: Date;
  }>;
  employeeSelfCheck?: IEmployeeSelfCheck;
  managerReview?: IManagerReview;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionAnswerSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
});

const EmployeeSelfCheckSchema = new Schema({
  completedAt: { type: Date, default: Date.now },
  responses: { type: [QuestionAnswerSchema], default: [] },
  confidenceRating: { type: Number, min: 1, max: 5 },
  comments: { type: String },
});

const ManagerReviewSchema = new Schema({
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
  reviewedAt: { type: Date, default: Date.now },
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "needs_action"],
    default: "pending",
  },
  performanceRating: { type: Number, min: 1, max: 5 },
  feedback: { type: String },
});

const EmployeeMilestoneSchema = new Schema<IEmployeeMilestone>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    templateId: { type: Schema.Types.ObjectId, required: true, ref: "MilestoneTemplate" },
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    milestoneTitle: { type: String, required: true },
    targetDay: { type: Number, enum: [30, 60, 90, 180], required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "in_review", "completed", "overdue"],
      default: "pending",
    },
    goalsProgress: [
      {
        goalTitle: { type: String, required: true },
        completed: { type: Boolean, default: false },
        completedAt: { type: Date },
      },
    ],
    employeeSelfCheck: { type: EmployeeSelfCheckSchema },
    managerReview: { type: ManagerReviewSchema },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

EmployeeMilestoneSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
EmployeeMilestoneSchema.index({ organizationId: 1, targetDay: 1 });

export const EmployeeMilestone = mongoose.model<IEmployeeMilestone>("EmployeeMilestone", EmployeeMilestoneSchema);
export default EmployeeMilestone;
