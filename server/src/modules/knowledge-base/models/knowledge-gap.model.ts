import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeGap extends Document {
  organizationId: mongoose.Types.ObjectId;
  question: string;
  normalizedQuestion: string;
  category?: string;
  occurrenceCount: number;
  requestedBy: mongoose.Types.ObjectId[];
  status: "unresolved" | "resolved" | "dismissed";
  priority: "low" | "medium" | "high" | "critical";
  resolutionResourceId?: mongoose.Types.ObjectId;
  resolutionType?: "quick_answer" | "article";
  resolutionNotes?: string;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  lastAskedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeGapSchema = new Schema<IKnowledgeGap>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization", index: true },
    question: { type: String, required: true, trim: true },
    normalizedQuestion: { type: String, required: true, trim: true, index: true },
    category: { type: String, default: "General Policy" },
    occurrenceCount: { type: Number, default: 1 },
    requestedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["unresolved", "resolved", "dismissed"],
      default: "unresolved",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    resolutionResourceId: { type: Schema.Types.ObjectId, ref: "Article" },
    resolutionType: {
      type: String,
      enum: ["quick_answer", "article"],
    },
    resolutionNotes: { type: String },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    lastAskedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
KnowledgeGapSchema.index({ organizationId: 1, status: 1, occurrenceCount: -1 });
KnowledgeGapSchema.index({ organizationId: 1, normalizedQuestion: 1 });

export const KnowledgeGap = mongoose.model<IKnowledgeGap>(
  "KnowledgeGap",
  KnowledgeGapSchema,
  "knowledgeGaps"
);

export default KnowledgeGap;
