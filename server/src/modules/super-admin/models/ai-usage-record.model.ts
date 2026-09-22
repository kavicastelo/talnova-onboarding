import mongoose, { Schema, Document, Model } from "mongoose";

export type AIFeatureType = "ai_course_builder" | "ai_assistant" | "kb_rag" | "document_summary" | "milestone_reflection";
export type AIProviderType = "gemini" | "openai" | "anthropic" | "azure_openai" | "custom";
export type AIInvocationStatus = "success" | "error";

export interface IAIUsageRecord extends Omit<Document, "model"> {
  organizationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  feature: AIFeatureType;
  provider: AIProviderType;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: AIInvocationStatus;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIUsageRecordSchema = new Schema<IAIUsageRecord>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    feature: {
      type: String,
      enum: ["ai_course_builder", "ai_assistant", "kb_rag", "document_summary", "milestone_reflection"],
      required: true,
      index: true
    },
    provider: {
      type: String,
      enum: ["gemini", "google", "openai", "anthropic", "azure_openai", "custom"],
      required: true
    },
    model: {
      type: String,
      required: true,
      trim: true
    },
    inputTokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "promptTokens"
    },
    outputTokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "completionTokens"
    },
    totalTokens: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    estimatedCostUsd: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "costEstimateUSD"
    },
    latencyMs: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      alias: "durationMs"
    },
    status: {
      type: String,
      enum: ["success", "error"],
      default: "success"
    },
    errorMessage: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    collection: "ai_usage_records"
  }
);

// Compound Indexes for fast dashboard and time-series telemetry aggregations
AIUsageRecordSchema.index({ organizationId: 1, createdAt: -1 });
AIUsageRecordSchema.index({ feature: 1, createdAt: -1 });
AIUsageRecordSchema.index({ provider: 1, model: 1 });
AIUsageRecordSchema.index({ createdAt: -1 });

// Ensure totalTokens is accurately computed before validation and support naming aliases
AIUsageRecordSchema.pre("validate", function (next) {
  const doc = this as any;
  if (this.inputTokens === undefined || this.inputTokens === 0) {
    if (doc.promptTokens !== undefined) this.inputTokens = Number(doc.promptTokens) || 0;
  }
  if (this.outputTokens === undefined || this.outputTokens === 0) {
    if (doc.completionTokens !== undefined) this.outputTokens = Number(doc.completionTokens) || 0;
  }
  if (this.latencyMs === undefined || this.latencyMs === 0) {
    if (doc.durationMs !== undefined) this.latencyMs = Number(doc.durationMs) || 0;
  }
  if (this.estimatedCostUsd === undefined || this.estimatedCostUsd === 0) {
    if (doc.costEstimateUSD !== undefined) this.estimatedCostUsd = Number(doc.costEstimateUSD) || 0;
  }
  if (this.inputTokens !== undefined && this.outputTokens !== undefined) {
    this.totalTokens = Math.max(0, this.inputTokens + this.outputTokens);
  }
  if (this.estimatedCostUsd !== undefined) {
    this.estimatedCostUsd = Math.max(0, Math.round(this.estimatedCostUsd * 100000) / 100000);
  }
  next();
});

export const AIUsageRecord: Model<IAIUsageRecord> =
  mongoose.models.AIUsageRecord ||
  mongoose.model<IAIUsageRecord>("AIUsageRecord", AIUsageRecordSchema);

export default AIUsageRecord;
