import mongoose, { Schema, Document } from "mongoose";
import { IUploadReference } from "../../organizations/models/organization.model.js";

export interface IOption {
  _id: mongoose.Types.ObjectId;
  text: string;
  isCorrect: boolean;
}

export interface IQuestion {
  _id: mongoose.Types.ObjectId;
  type: "single_choice" | "multiple_choice" | "true_false";
  question: string;
  options: IOption[];
  explanation?: string;
  points: number;
}

export interface IQuiz {
  _id: mongoose.Types.ObjectId;
  title: string;
  passingScore: number;
  questions: IQuestion[];
}

export interface IAttachment {
  _id: mongoose.Types.ObjectId;
  title: string;
  uploadId: mongoose.Types.ObjectId;
  downloadable: boolean;
}

export interface IContentBlock {
  _id: mongoose.Types.ObjectId;
  type: "video" | "audio" | "image" | "pdf" | "document" | "text" | "embed" | "checklist";
  title?: string;
  content?: string;
  uploadId?: mongoose.Types.ObjectId;
  embedUrl?: string;
  order: number;
  settings?: {
    autoplay?: boolean;
    downloadable?: boolean;
    requiredViewPercentage?: number;
  };
}

export interface ILesson {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  estimatedDurationMinutes: number;
  contentBlocks: IContentBlock[];
  attachments: IAttachment[];
  quiz?: IQuiz;
  completionRules: {
    requireContentCompletion: boolean;
    requireQuizCompletion: boolean;
    minimumQuizScore?: number;
  };
}

export interface IModule {
  _id: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  order: number;
  estimatedDurationMinutes: number;
  lessons: ILesson[];
}

export interface IJourney extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  description: string;
  thumbnail?: IUploadReference;
  category?: string;
  tags: string[];
  audience: {
    departments?: mongoose.Types.ObjectId[];
    teams?: mongoose.Types.ObjectId[];
    jobTitles?: mongoose.Types.ObjectId[];
    employmentTypes?: string[];
    isPublic?: boolean;
  };
  modules: IModule[];
  certificate: {
    enabled: boolean;
    templateId?: mongoose.Types.ObjectId;
    passingScore?: number;
  };
  publishing: {
    status: "draft" | "published" | "archived";
    publishedAt?: Date;
    version: number;
  };
  analytics: {
    totalAssignments: number;
    totalCompletions: number;
    completionRate: number;
    averageScore: number;
    averageDurationMinutes: number;
  };
  settings: {
    allowSkipLessons: boolean;
    requireSequentialCompletion: boolean;
    allowRetakes: boolean;
    maxRetakes?: number;
  };
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UploadReferenceSchema = new Schema({
  uploadId: { type: Schema.Types.ObjectId, required: true },
  fileName: { type: String, required: true },
  publicUrl: { type: String },
});

const OptionSchema = new Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true, default: false },
});

const QuestionSchema = new Schema({
  type: {
    type: String,
    enum: ["single_choice", "multiple_choice", "true_false"],
    required: true,
  },
  question: { type: String, required: true },
  options: { type: [OptionSchema], default: [] },
  explanation: { type: String },
  points: { type: Number, default: 1 },
});

const QuizSchema = new Schema({
  title: { type: String, required: true },
  passingScore: { type: Number, default: 80 },
  questions: { type: [QuestionSchema], default: [] },
});

const AttachmentSchema = new Schema({
  title: { type: String, required: true },
  uploadId: { type: Schema.Types.ObjectId, required: true },
  downloadable: { type: Boolean, default: true },
});

const ContentBlockSchema = new Schema({
  type: {
    type: String,
    enum: ["video", "audio", "image", "pdf", "document", "text", "embed", "checklist"],
    required: true,
  },
  title: { type: String },
  content: { type: String },
  uploadId: { type: Schema.Types.ObjectId },
  embedUrl: { type: String },
  order: { type: Number, required: true },
  settings: {
    autoplay: { type: Boolean },
    downloadable: { type: Boolean },
    requiredViewPercentage: { type: Number },
  },
});

const LessonSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  order: { type: Number, required: true },
  estimatedDurationMinutes: { type: Number, default: 0 },
  contentBlocks: { type: [ContentBlockSchema], default: [] },
  attachments: { type: [AttachmentSchema], default: [] },
  quiz: { type: QuizSchema },
  completionRules: {
    requireContentCompletion: { type: Boolean, default: true },
    requireQuizCompletion: { type: Boolean, default: false },
    minimumQuizScore: { type: Number },
  },
});

const ModuleSchema = new Schema({
  title: { type: String, required: true },
  description: { type: String },
  order: { type: Number, required: true },
  estimatedDurationMinutes: { type: Number, default: 0 },
  lessons: { type: [LessonSchema], default: [] },
});

const JourneySchema = new Schema<IJourney>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    thumbnail: { type: UploadReferenceSchema },
    category: { type: String },
    tags: { type: [String], default: [] },
    audience: {
      departments: { type: [Schema.Types.ObjectId], ref: "Organization.departments" },
      teams: { type: [Schema.Types.ObjectId], ref: "Organization.teams" },
      jobTitles: { type: [Schema.Types.ObjectId] },
      employmentTypes: { type: [String] },
      isPublic: { type: Boolean, default: false },
    },
    modules: { type: [ModuleSchema], default: [] },
    certificate: {
      enabled: { type: Boolean, default: false },
      templateId: { type: Schema.Types.ObjectId },
      passingScore: { type: Number, default: 80 },
    },
    publishing: {
      status: {
        type: String,
        enum: ["draft", "published", "archived"],
        default: "draft",
      },
      publishedAt: { type: Date },
      version: { type: Number, default: 1 },
    },
    analytics: {
      totalAssignments: { type: Number, default: 0 },
      totalCompletions: { type: Number, default: 0 },
      completionRate: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      averageDurationMinutes: { type: Number, default: 0 },
    },
    settings: {
      allowSkipLessons: { type: Boolean, default: false },
      requireSequentialCompletion: { type: Boolean, default: true },
      allowRetakes: { type: Boolean, default: true },
      maxRetakes: { type: Number },
    },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
JourneySchema.index({ organizationId: 1 });
JourneySchema.index({ slug: 1 });
JourneySchema.index({ "publishing.status": 1 });
JourneySchema.index({ createdBy: 1 });
JourneySchema.index({ createdAt: 1 });

// Compound indexes
JourneySchema.index({ organizationId: 1, isDeleted: 1 });
JourneySchema.index({ organizationId: 1, "publishing.status": 1 });
JourneySchema.index({ organizationId: 1, category: 1 });
JourneySchema.index({ organizationId: 1, tags: 1 });
JourneySchema.index({ organizationId: 1, createdAt: 1 });

export const Journey = mongoose.model<IJourney>("Journey", JourneySchema);
export default Journey;
