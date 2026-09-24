import mongoose, { Schema, Document } from "mongoose";
import { getDemoConnection } from "../database/demo-connection.js";

export interface IDemoJourney extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  durationDays: number;
  status: "published" | "draft";
  modulesCount: number;
}

const DemoJourneySchema = new Schema<IDemoJourney>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, default: "Engineering" },
    durationDays: { type: Number, default: 30 },
    status: { type: String, enum: ["published", "draft"], default: "published" },
    modulesCount: { type: Number, default: 5 },
  },
  { timestamps: true, strict: false }
);

export interface IDemoTask extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  demoUserId?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  status: string;
  priority?: string;
  stage?: string;
  dueDays: number;
}

const DemoTaskSchema = new Schema<IDemoTask>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser" },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      default: "hr_compliance",
    },
    status: { type: String, default: "pending" },
    priority: { type: String, default: "normal" },
    stage: { type: String, default: "day_1" },
    dueDays: { type: Number, default: 7 },
  },
  { timestamps: true, strict: false }
);

export interface IDemoDocument extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  title: string;
  documentType: string;
  category?: string;
  status: string;
  signedAt?: Date;
  signeeName?: string;
  content?: string;
  renderedContent?: string;
}

const DemoDocumentSchema = new Schema<IDemoDocument>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    title: { type: String, required: true },
    documentType: {
      type: String,
      required: true,
    },
    status: { type: String, default: "pending_signature" },
    signedAt: { type: Date },
    signeeName: { type: String },
  },
  { timestamps: true, strict: false }
);

export function getDemoJourneyModel(): mongoose.Model<IDemoJourney> {
  const conn = getDemoConnection();
  return (conn.models.DemoJourney as mongoose.Model<IDemoJourney>) || conn.model<IDemoJourney>("DemoJourney", DemoJourneySchema);
}

export function getDemoTaskModel(): mongoose.Model<IDemoTask> {
  const conn = getDemoConnection();
  return (conn.models.DemoTask as mongoose.Model<IDemoTask>) || conn.model<IDemoTask>("DemoTask", DemoTaskSchema);
}

export function getDemoDocumentModel(): mongoose.Model<IDemoDocument> {
  const conn = getDemoConnection();
  return (conn.models.DemoDocument as mongoose.Model<IDemoDocument>) || conn.model<IDemoDocument>("DemoDocument", DemoDocumentSchema);
}

export interface IDemoKBArticle extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  title: string;
  summary: string;
  category: string;
  content: string;
  readTimeMinutes: number;
}

const DemoKBArticleSchema = new Schema<IDemoKBArticle>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    category: { type: String, default: "General" },
    content: { type: String, required: true },
    readTimeMinutes: { type: Number, default: 3 },
  },
  { timestamps: true, strict: false }
);

export function getDemoKBArticleModel(): mongoose.Model<IDemoKBArticle> {
  const conn = getDemoConnection();
  return (conn.models.DemoKBArticle as mongoose.Model<IDemoKBArticle>) || conn.model<IDemoKBArticle>("DemoKBArticle", DemoKBArticleSchema);
}

export interface IDemoMilestone extends Document {
  demoTenantId: mongoose.Types.ObjectId;
  demoUserId?: mongoose.Types.ObjectId;
  title: string;
  description: string;
  points: number;
  badgeIcon: string;
  status: string;
  awardedAt?: Date;
}

const DemoMilestoneSchema = new Schema<IDemoMilestone>(
  {
    demoTenantId: { type: Schema.Types.ObjectId, ref: "DemoTenant", required: true },
    demoUserId: { type: Schema.Types.ObjectId, ref: "DemoUser" },
    title: { type: String, required: true },
    description: { type: String, required: true },
    points: { type: Number, default: 100 },
    badgeIcon: { type: String, default: "award" },
    status: { type: String, default: "unlocked" },
    awardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true, strict: false }
);

export function getDemoMilestoneModel(): mongoose.Model<IDemoMilestone> {
  const conn = getDemoConnection();
  return (conn.models.DemoMilestone as mongoose.Model<IDemoMilestone>) || conn.model<IDemoMilestone>("DemoMilestone", DemoMilestoneSchema);
}

