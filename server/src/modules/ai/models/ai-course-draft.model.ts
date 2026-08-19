import mongoose, { Schema, Document } from "mongoose";

export interface IAICourseQuizQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface IAICourseLesson {
  lessonId: string;
  title: string;
  content: string;
  durationMinutes: number;
  quizQuestions: IAICourseQuizQuestion[];
}

export interface IAICourseModule {
  moduleId: string;
  title: string;
  description: string;
  lessons: IAICourseLesson[];
}

export interface IAICourseDraft extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  targetRole: string;
  department: string;
  status: "draft" | "approved" | "published";
  modules: IAICourseModule[];
  version: number;
  publishedJourneyId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AICourseQuizQuestionSchema = new Schema<IAICourseQuizQuestion>(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String },
  },
  { _id: false }
);

const AICourseLessonSchema = new Schema<IAICourseLesson>(
  {
    lessonId: { type: String, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    durationMinutes: { type: Number, default: 15 },
    quizQuestions: { type: [AICourseQuizQuestionSchema], default: [] },
  },
  { _id: false }
);

const AICourseModuleSchema = new Schema<IAICourseModule>(
  {
    moduleId: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    lessons: { type: [AICourseLessonSchema], default: [] },
  },
  { _id: false }
);

const AICourseDraftSchema = new Schema<IAICourseDraft>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true },
    description: { type: String, required: true },
    targetRole: { type: String, required: true, default: "All Roles" },
    department: { type: String, required: true, default: "General" },
    status: { type: String, enum: ["draft", "approved", "published"], default: "draft" },
    modules: { type: [AICourseModuleSchema], default: [] },
    version: { type: Number, default: 1 },
    publishedJourneyId: { type: Schema.Types.ObjectId, ref: "Journey" },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
  },
  {
    timestamps: true,
  }
);

AICourseDraftSchema.index({ organizationId: 1, status: 1 });

export const AICourseDraft = mongoose.model<IAICourseDraft>("AICourseDraft", AICourseDraftSchema);
export default AICourseDraft;
