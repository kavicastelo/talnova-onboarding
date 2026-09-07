import mongoose, { Document, Schema } from "mongoose";

export type OnboardingCaseState =
  | "created"
  | "resolving"
  | "provisioning"
  | "provisioning_failed"
  | "ready"
  | "active"
  | "paused"
  | "ready_for_handover"
  | "handover_pending"
  | "completed"
  | "archived"
  | "cancelled";

export type OnboardingCaseSource = "invite" | "bulk_import" | "sso" | "hris" | "manual" | "rehire";

export interface IOnboardingCaseTransition {
  from: OnboardingCaseState | null;
  to: OnboardingCaseState;
  at: Date;
  actorUserId?: mongoose.Types.ObjectId;
  reason?: string;
}

export interface IOnboardingCase extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  source: OnboardingCaseSource;
  idempotencyKey: string;
  state: OnboardingCaseState;
  stateReason?: string;
  transitions: IOnboardingCaseTransition[];
  resolvedPlan?: { planId: string; version?: number; resolvedAt: Date; reason?: string };
  failure?: { resourceKey?: string; message: string; attempts: number; lastAttemptAt: Date };
  createdBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TransitionSchema = new Schema<IOnboardingCaseTransition>(
  {
    from: { type: String, required: false },
    to: { type: String, required: true },
    at: { type: Date, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String },
  },
  { _id: false }
);

const OnboardingCaseSchema = new Schema<IOnboardingCase>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, enum: ["invite", "bulk_import", "sso", "hris", "manual", "rehire"], required: true },
    idempotencyKey: { type: String, required: true, trim: true },
    state: {
      type: String,
      enum: ["created", "resolving", "provisioning", "provisioning_failed", "ready", "active", "paused", "ready_for_handover", "handover_pending", "completed", "archived", "cancelled"],
      required: true,
      default: "created",
    },
    stateReason: { type: String },
    transitions: { type: [TransitionSchema], default: [] },
    resolvedPlan: {
      planId: { type: String },
      version: { type: Number },
      resolvedAt: { type: Date },
      reason: { type: String },
    },
    failure: {
      resourceKey: { type: String },
      message: { type: String },
      attempts: { type: Number },
      lastAttemptAt: { type: Date },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One external source event may create exactly one active case for a tenant.
OnboardingCaseSchema.index({ organizationId: 1, idempotencyKey: 1 }, { unique: true });
OnboardingCaseSchema.index({ organizationId: 1, employeeId: 1, state: 1 });

export const OnboardingCase = mongoose.model<IOnboardingCase>("OnboardingCase", OnboardingCaseSchema, "onboarding_cases");
export default OnboardingCase;
