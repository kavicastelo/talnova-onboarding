import mongoose, { Schema, Document } from "mongoose";

export interface IDealStageHistory {
  fromStage: string;
  toStage: string;
  changedBy?: mongoose.Types.ObjectId;
  changedAt: Date;
  daysInPreviousStage?: number;
}

export interface IDealWonDetails {
  contractSignedDate?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  onboardingHandedOff: boolean;
  handoffDate?: Date;
  organizationId?: mongoose.Types.ObjectId;
}

export interface IDeal extends Document {
  organizationId?: mongoose.Types.ObjectId;
  name: string;
  companyId: mongoose.Types.ObjectId;
  primaryContactId?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  pipelineId: mongoose.Types.ObjectId;
  stage: string;
  ownerId?: mongoose.Types.ObjectId;
  value: number;
  currency: string;
  annualRecurringRevenue: number;
  oneTimeImplementationFee: number;
  probability: number; // 0.0 to 1.0
  expectedCloseDate?: Date;
  actualCloseDate?: Date;
  competitors?: string[];
  nextAction?: string;
  lossReason?: string;
  lossDetails?: string;
  healthScore?: number;
  riskFlags?: string[];
  wonDetails?: IDealWonDetails;
  packageId?: mongoose.Types.ObjectId;
  stageHistory: IDealStageHistory[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DealStageHistorySchema = new Schema<IDealStageHistory>({
  fromStage: { type: String, required: true },
  toStage: { type: String, required: true },
  changedBy: { type: Schema.Types.ObjectId, ref: "User" },
  changedAt: { type: Date, default: Date.now },
  daysInPreviousStage: { type: Number },
});

const DealSchema = new Schema<IDeal>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "SalesCompany", required: true, index: true },
    primaryContactId: { type: Schema.Types.ObjectId, ref: "SalesContact", index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "SalesLead", index: true },
    pipelineId: { type: Schema.Types.ObjectId, ref: "SalesPipeline", required: true, index: true },
    stage: { type: String, required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    value: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "USD" },
    annualRecurringRevenue: { type: Number, default: 0 },
    oneTimeImplementationFee: { type: Number, default: 0 },
    probability: { type: Number, required: true, min: 0, max: 1, default: 0.1 },
    expectedCloseDate: { type: Date, index: true },
    actualCloseDate: { type: Date },
    competitors: [{ type: String }],
    nextAction: { type: String, trim: true },
    lossReason: { type: String, trim: true },
    lossDetails: { type: String, trim: true },
    healthScore: { type: Number, min: 0, max: 100, default: 80 },
    riskFlags: [{ type: String, trim: true }],
    wonDetails: {
      contractSignedDate: Date,
      approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
      onboardingHandedOff: { type: Boolean, default: false },
      handoffDate: Date,
      organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    },
    packageId: { type: Schema.Types.ObjectId, ref: "Package" },
    stageHistory: [DealStageHistorySchema],
    notes: { type: String },
  },
  {
    timestamps: true,
  }
);

DealSchema.index({ stage: 1, ownerId: 1 });
DealSchema.index({ stage: 1, expectedCloseDate: 1 });
DealSchema.index({ companyId: 1, stage: 1 });
DealSchema.index({ stage: 1, updatedAt: 1 });

export const Deal = mongoose.model<IDeal>("SalesDeal", DealSchema);
export default Deal;
