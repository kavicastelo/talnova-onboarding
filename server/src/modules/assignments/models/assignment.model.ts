import mongoose, { Schema, Document } from "mongoose";

export interface IAnswer {
  questionId: mongoose.Types.ObjectId;
  selectedOptions: mongoose.Types.ObjectId[];
  correct: boolean;
  pointsEarned: number;
}

export interface IQuizAttempt {
  attemptNumber: number;
  startedAt: Date;
  submittedAt?: Date;
  score: number; // percentage (0 to 100)
  passed: boolean;
  answers: IAnswer[];
}

export interface IContentBlockProgress {
  blockId: mongoose.Types.ObjectId;
  type: string;
  viewed: boolean;
  viewedPercentage?: number;
  completedAt?: Date;
}

export interface ILessonProgress {
  lessonId: mongoose.Types.ObjectId;
  title: string;
  status: "not_started" | "in_progress" | "completed";
  completedAt?: Date;
  timeSpentSeconds: number;
  contentBlocks: IContentBlockProgress[];
  quizAttempt?: IQuizAttempt;
}

export interface IModuleProgress {
  moduleId: mongoose.Types.ObjectId;
  title: string;
  completed: boolean;
  completedAt?: Date;
  lessons: ILessonProgress[];
}

export interface IEmployeeAssignment extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  assignedBy: mongoose.Types.ObjectId;
  journey: {
    journeyId: mongoose.Types.ObjectId;
    title: string;
    version: number;
  };
  assignment: {
    assignedAt: Date;
    dueDate?: Date;
    priority: "low" | "normal" | "high" | "critical";
  };
  status: "assigned" | "in_progress" | "completed" | "overdue" | "expired";
  progress: {
    totalModules: number;
    completedModules: number;
    totalLessons: number;
    completedLessons: number;
    completionPercentage: number;
    totalTimeSpentSeconds: number;
    lastActivityAt?: Date;
  };
  modules: IModuleProgress[];
  certificate?: {
    issued: boolean;
    issuedAt?: Date;
    certificateId?: mongoose.Types.ObjectId;
  };
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AnswerSchema = new Schema({
  questionId: { type: Schema.Types.ObjectId, required: true },
  selectedOptions: { type: [Schema.Types.ObjectId], default: [] },
  correct: { type: Boolean, required: true },
  pointsEarned: { type: Number, required: true },
});

const QuizAttemptSchema = new Schema({
  attemptNumber: { type: Number, required: true },
  startedAt: { type: Date, required: true },
  submittedAt: { type: Date },
  score: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  answers: { type: [AnswerSchema], default: [] },
});

const ContentBlockProgressSchema = new Schema({
  blockId: { type: Schema.Types.ObjectId, required: true },
  type: { type: String, required: true },
  viewed: { type: Boolean, default: false },
  viewedPercentage: { type: Number },
  completedAt: { type: Date },
});

const LessonProgressSchema = new Schema({
  lessonId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  status: {
    type: String,
    enum: ["not_started", "in_progress", "completed"],
    default: "not_started",
  },
  completedAt: { type: Date },
  timeSpentSeconds: { type: Number, default: 0 },
  contentBlocks: { type: [ContentBlockProgressSchema], default: [] },
  quizAttempt: { type: QuizAttemptSchema },
});

const ModuleProgressSchema = new Schema({
  moduleId: { type: Schema.Types.ObjectId, required: true },
  title: { type: String, required: true },
  completed: { type: Boolean, default: false },
  completedAt: { type: Date },
  lessons: { type: [LessonProgressSchema], default: [] },
});

const EmployeeAssignmentSchema = new Schema<IEmployeeAssignment>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    employeeId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    journey: {
      journeyId: { type: Schema.Types.ObjectId, required: true, ref: "Journey" },
      title: { type: String, required: true },
      version: { type: Number, required: true },
    },
    assignment: {
      assignedAt: { type: Date, required: true, default: Date.now },
      dueDate: { type: Date },
      priority: {
        type: String,
        enum: ["low", "normal", "high", "critical"],
        default: "normal",
      },
    },
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "overdue", "expired"],
      default: "assigned",
    },
    progress: {
      totalModules: { type: Number, required: true, default: 0 },
      completedModules: { type: Number, required: true, default: 0 },
      totalLessons: { type: Number, required: true, default: 0 },
      completedLessons: { type: Number, required: true, default: 0 },
      completionPercentage: { type: Number, required: true, default: 0 },
      totalTimeSpentSeconds: { type: Number, required: true, default: 0 },
      lastActivityAt: { type: Date },
    },
    modules: { type: [ModuleProgressSchema], default: [] },
    certificate: {
      issued: { type: Boolean, default: false },
      issuedAt: { type: Date },
      certificateId: { type: Schema.Types.ObjectId },
    },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
EmployeeAssignmentSchema.index({ organizationId: 1 });
EmployeeAssignmentSchema.index({ employeeId: 1 });
EmployeeAssignmentSchema.index({ status: 1 });
EmployeeAssignmentSchema.index({ completedAt: 1 });
EmployeeAssignmentSchema.index({ updatedAt: 1 });

// Compound indexes
EmployeeAssignmentSchema.index({ organizationId: 1, employeeId: 1 });
EmployeeAssignmentSchema.index({ organizationId: 1, status: 1 });
EmployeeAssignmentSchema.index({ employeeId: 1, status: 1 });
EmployeeAssignmentSchema.index({ organizationId: 1, completedAt: 1 });
EmployeeAssignmentSchema.index({ organizationId: 1, "journey.journeyId": 1 });

export const EmployeeAssignment = mongoose.model<IEmployeeAssignment>(
  "EmployeeAssignment",
  EmployeeAssignmentSchema,
  "employeeAssignments" // Force standard collection name
);

export default EmployeeAssignment;
