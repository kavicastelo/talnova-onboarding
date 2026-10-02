import mongoose, { Schema, Document } from "mongoose";
import { KioskAnalytics } from "../types/analytics.types.js";

/**
 * PII key names that must be permanently redacted from product UX analytics
 * documents under GDPR compliance requirements.
 */
export const GDPR_ANALYTICS_REDACTED_FIELDS = [
  "ipAddress",
  "userId",
  "user",
  "employeeId",
  "workerId",
  "workerName",
  "email",
  "name",
  "token",
  "sessionToken",
  "signature",
  "verificationChecksum",
  "supervisorWitness"
] as const;

/**
 * Interface representing the KioskAnalytics document in MongoDB.
 * Refactored under K-ANA-001 to focus purely on aggregated product & UX analytics
 * with 12-month retention and strict GDPR PII scrubbing.
 */
export interface IKioskAnalytics extends Omit<KioskAnalytics, "_id" | "organizationId" | "deviceId" | "journeyId" | "interactions">, Document {
  organizationId: mongoose.Types.ObjectId;
  deviceId?: mongoose.Types.ObjectId;
  journeyId: mongoose.Types.ObjectId;
  stepId?: string;
  eventType?: string;
  stepFunnels?: Array<{
    stepId: string;
    stepIndex?: number;
    stepTitle?: string;
    dwellTimeSeconds: number;
    isDropOff: boolean;
    completed: boolean;
  }>;
  interactions: Array<{
    stepId: string;
    elementClicked: string;
    eventType?: string;
    dwellTimeSeconds?: number;
    timestamp: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const KioskSessionMetricsSchema = new Schema(
  {
    launchesCount: { type: Number, required: true, min: 0 },
    completedCount: { type: Number, required: true, min: 0 },
    durationSeconds: { type: Number, required: true, min: 0 },
    abortedStepId: { type: String }
  },
  { _id: false }
);

const StepFunnelItemSchema = new Schema(
  {
    stepId: { type: String, required: true },
    stepIndex: { type: Number },
    stepTitle: { type: String },
    dwellTimeSeconds: { type: Number, default: 0, min: 0 },
    isDropOff: { type: Boolean, default: false },
    completed: { type: Boolean, default: false }
  },
  { _id: false }
);

const KioskUserInteractionSchema = new Schema(
  {
    stepId: { type: String, required: true },
    elementClicked: { type: String, required: true },
    eventType: { type: String },
    dwellTimeSeconds: { type: Number, min: 0 },
    timestamp: { type: Date, required: true, default: Date.now }
  },
  { _id: false }
);

const KioskAnalyticsSchema = new Schema<IKioskAnalytics>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    deviceId: { type: Schema.Types.ObjectId, ref: "KioskDevice" },
    journeyId: { type: Schema.Types.ObjectId, required: true, ref: "KioskJourney" },
    journeyVersion: { type: Number, required: true, min: 1 },
    languageUsed: { type: String, required: true },
    stepId: { type: String },
    eventType: { type: String },
    metrics: { type: KioskSessionMetricsSchema, required: true },
    stepFunnels: { type: [StepFunnelItemSchema], default: [] },
    interactions: { type: [KioskUserInteractionSchema], default: [] },
    dateKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }
  },
  {
    timestamps: true
  }
);

/**
 * GDPR PII Redaction Middleware:
 * Ensures anonymous journeys and analytics records never persist IP addresses,
 * employee IDs, or user references in analytics documents.
 */
KioskAnalyticsSchema.pre("save", function (next) {
  const doc = this as any;
  for (const field of GDPR_ANALYTICS_REDACTED_FIELDS) {
    if (doc[field] !== undefined) {
      delete doc[field];
      doc.set(field, undefined);
    }
  }
  next();
});

// Indexes
KioskAnalyticsSchema.index({ organizationId: 1 });
KioskAnalyticsSchema.index({ journeyId: 1 });
KioskAnalyticsSchema.index({ deviceId: 1 });
KioskAnalyticsSchema.index({ dateKey: 1 });

// TTL Index: 12-Month Retention for Product & UX Analytics (365 Days = 31,536,000s)
KioskAnalyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Compound indexes for aggregates & funnel reports
KioskAnalyticsSchema.index({ organizationId: 1, journeyId: 1, dateKey: 1 });
KioskAnalyticsSchema.index({ organizationId: 1, dateKey: 1 });
KioskAnalyticsSchema.index({ journeyId: 1, "metrics.abortedStepId": 1 });
KioskAnalyticsSchema.index({ journeyId: 1, "stepFunnels.stepId": 1 });

export const KioskAnalyticsModel = mongoose.model<IKioskAnalytics>("KioskAnalytics", KioskAnalyticsSchema);
export default KioskAnalyticsModel;
