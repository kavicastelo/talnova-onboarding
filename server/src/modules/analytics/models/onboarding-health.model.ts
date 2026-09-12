import mongoose, { Document, Schema } from "mongoose";

export interface IOnboardingHealth extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  assignmentId?: mongoose.Types.ObjectId;
  velocity: number;
  expectedVelocity: number;
  dropOffRiskScore: number;
  riskLevel: "on_track" | "at_risk" | "critical";
  completedItemsCount: number;
  totalItemsCount: number;
  daysInactive: number;
  itemsOverdue: number;
  lastActiveAt: Date;
  lastNudgedAt?: Date;
  nudgeLevel: number;
  lastNudgeMessage?: string;
  suppressedReason?: string;
  calculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OnboardingHealthSchema = new Schema<IOnboardingHealth>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    assignmentId: { type: Schema.Types.ObjectId, ref: "EmployeeAssignment" },
    velocity: { type: Number, default: 0 },
    expectedVelocity: { type: Number, default: 0 },
    dropOffRiskScore: { type: Number, default: 0, min: 0, max: 1 },
    riskLevel: {
      type: String,
      enum: ["on_track", "at_risk", "critical"],
      default: "on_track",
    },
    completedItemsCount: { type: Number, default: 0 },
    totalItemsCount: { type: Number, default: 0 },
    daysInactive: { type: Number, default: 0 },
    itemsOverdue: { type: Number, default: 0 },
    lastActiveAt: { type: Date, default: Date.now },
    lastNudgedAt: { type: Date },
    nudgeLevel: { type: Number, default: 0 },
    lastNudgeMessage: { type: String },
    suppressedReason: { type: String },
    calculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

OnboardingHealthSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
OnboardingHealthSchema.index({ organizationId: 1, dropOffRiskScore: -1 });
OnboardingHealthSchema.index({ organizationId: 1, riskLevel: 1 });

export const OnboardingHealth = mongoose.model<IOnboardingHealth>(
  "OnboardingHealth",
  OnboardingHealthSchema,
  "onboarding_health"
);
export default OnboardingHealth;
