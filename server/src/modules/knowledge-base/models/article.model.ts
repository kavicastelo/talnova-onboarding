import mongoose, { Schema, Document } from "mongoose";

export interface IArticleContentBlock {
  _id: mongoose.Types.ObjectId;
  type: "text" | "image" | "video" | "audio" | "pdf" | "document" | "embed" | "callout" | "code";
  content?: string;
  uploadId?: mongoose.Types.ObjectId;
  embedUrl?: string;
  order: number;
}

export interface IArticleAttachment {
  _id: mongoose.Types.ObjectId;
  title: string;
  uploadId: mongoose.Types.ObjectId;
  downloadable: boolean;
}

export interface IArticle extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  summary?: string;
  content: {
    blocks: IArticleContentBlock[];
  };
  categoryId?: mongoose.Types.ObjectId;
  tags: string[];
  visibility: {
    access: "all" | "department" | "team" | "custom";
    departments?: mongoose.Types.ObjectId[];
    teams?: mongoose.Types.ObjectId[];
    users?: mongoose.Types.ObjectId[];
  };
  attachments: IArticleAttachment[];
  analytics: {
    views: number;
    uniqueViews: number;
    averageReadTimeSeconds: number;
    lastViewedAt?: Date;
  };
  publishing: {
    status: "draft" | "published" | "archived";
    publishedAt?: Date;
    version: number;
  };
  searchKeywords: string[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ContentBlockSchema = new Schema({
  type: {
    type: String,
    enum: ["text", "image", "video", "audio", "pdf", "document", "embed", "callout", "code"],
    required: true,
  },
  content: { type: String },
  uploadId: { type: Schema.Types.ObjectId },
  embedUrl: { type: String },
  order: { type: Number, required: true },
});

const AttachmentSchema = new Schema({
  title: { type: String, required: true },
  uploadId: { type: Schema.Types.ObjectId, required: true },
  downloadable: { type: Boolean, default: true },
});

const ArticleSchema = new Schema<IArticle>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    summary: { type: String },
    content: {
      blocks: { type: [ContentBlockSchema], default: [] },
    },
    categoryId: { type: Schema.Types.ObjectId },
    tags: { type: [String], default: [] },
    visibility: {
      access: {
        type: String,
        enum: ["all", "department", "team", "custom"],
        default: "all",
      },
      departments: { type: [Schema.Types.ObjectId], ref: "Organization.departments" },
      teams: { type: [Schema.Types.ObjectId], ref: "Organization.teams" },
      users: { type: [Schema.Types.ObjectId], ref: "User" },
    },
    attachments: { type: [AttachmentSchema], default: [] },
    analytics: {
      views: { type: Number, default: 0 },
      uniqueViews: { type: Number, default: 0 },
      averageReadTimeSeconds: { type: Number, default: 0 },
      lastViewedAt: { type: Date },
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
    searchKeywords: { type: [String], default: [] },
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
ArticleSchema.index({ organizationId: 1 });
ArticleSchema.index({ slug: 1 });
ArticleSchema.index({ categoryId: 1 });
ArticleSchema.index({ "publishing.status": 1 });
ArticleSchema.index({ createdAt: 1 });

// Compound indexes
ArticleSchema.index({ organizationId: 1, isDeleted: 1 });
ArticleSchema.index({ organizationId: 1, slug: 1 });
ArticleSchema.index({ organizationId: 1, categoryId: 1 });
ArticleSchema.index({ organizationId: 1, "publishing.status": 1 });
ArticleSchema.index({ organizationId: 1, createdAt: 1 });

// Text index for search
ArticleSchema.index(
  {
    title: "text",
    summary: "text",
    "content.blocks.content": "text",
    tags: "text",
    searchKeywords: "text",
  },
  {
    weights: {
      title: 10,
      summary: 5,
      tags: 3,
      searchKeywords: 3,
      "content.blocks.content": 1,
    },
    name: "ArticleTextSearchIndex",
  }
);

export const Article = mongoose.model<IArticle>("Article", ArticleSchema, "knowledgeBase");
export default Article;
