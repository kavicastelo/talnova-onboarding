import mongoose, { Schema, Document } from "mongoose";

export interface ILeadNote {
  content: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ILeadScoreEvent {
  rule: string;
  points: number;
  timestamp: Date;
}

export interface ILeadConsent {
  emailMarketing: boolean;
  whatsappMarketing: boolean;
  consentTimestamp?: Date;
  consentSource?: string;
  optedOutAt?: Date;
}

export interface ILeadConverted {
  contactId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  dealId?: mongoose.Types.ObjectId;
  organizationId?: mongoose.Types.ObjectId;
  convertedAt?: Date;
  convertedBy?: mongoose.Types.ObjectId;
}

export interface ILead extends Document {
  organizationId?: mongoose.Types.ObjectId;
  name: string;
  email: string;
  normalizedEmail: string;
  phone?: string;
  normalizedPhone?: string;
  whatsapp?: string;
  companyName: string;
  jobTitle?: string;
  industry?: string;
  companySize?: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  country?: string;
  region?: string;
  source: "website" | "product_demo" | "referral" | "campaign" | "import" | "inbound_email" | "other";
  sourceDetails?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  status:
    | "new"
    | "contacted"
    | "engaged"
    | "qualified"
    | "opportunity"
    | "converted"
    | "nurturing"
    | "disqualified"
    | "unresponsive"
    | "lost"
    | "duplicate";
  disqualificationReason?: string;
  score: number;
  scoreBreakdown: ILeadScoreEvent[];
  assignedOwnerId?: mongoose.Types.ObjectId;
  priority: "low" | "normal" | "high" | "urgent";
  interestedProduct?: string;
  estimatedBudget?: number;
  currency: string;
  expectedPurchaseDate?: Date;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  consent: ILeadConsent;
  tags: string[];
  notes: ILeadNote[];
  convertedTo?: ILeadConverted;
  mergedIntoLeadId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LeadNoteSchema = new Schema<ILeadNote>({
  content: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const LeadScoreEventSchema = new Schema<ILeadScoreEvent>({
  rule: { type: String, required: true },
  points: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const LeadSchema = new Schema<ILead>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    normalizedEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    normalizedPhone: { type: String, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    companyName: { type: String, required: true, trim: true, index: true },
    jobTitle: { type: String, trim: true },
    industry: { type: String, trim: true, index: true },
    companySize: {
      type: String,
      enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"],
    },
    country: { type: String, trim: true },
    region: { type: String, trim: true },
    source: {
      type: String,
      enum: ["website", "product_demo", "referral", "campaign", "import", "inbound_email", "other"],
      default: "website",
      index: true,
    },
    sourceDetails: { type: String, trim: true },
    utm: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String,
    },
    status: {
      type: String,
      enum: [
        "new",
        "contacted",
        "engaged",
        "qualified",
        "opportunity",
        "converted",
        "nurturing",
        "disqualified",
        "unresponsive",
        "lost",
        "duplicate",
      ],
      default: "new",
      index: true,
    },
    disqualificationReason: { type: String, trim: true },
    score: { type: Number, default: 0, index: true },
    scoreBreakdown: [LeadScoreEventSchema],
    assignedOwnerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    interestedProduct: { type: String, trim: true },
    estimatedBudget: { type: Number },
    currency: { type: String, default: "USD" },
    expectedPurchaseDate: { type: Date },
    lastContactDate: { type: Date },
    nextFollowUpDate: { type: Date, index: true },
    consent: {
      emailMarketing: { type: Boolean, default: false },
      whatsappMarketing: { type: Boolean, default: false },
      consentTimestamp: Date,
      consentSource: String,
      optedOutAt: Date,
    },
    tags: [{ type: String, trim: true, index: true }],
    notes: [LeadNoteSchema],
    convertedTo: {
      contactId: { type: Schema.Types.ObjectId, ref: "SalesContact" },
      companyId: { type: Schema.Types.ObjectId, ref: "SalesCompany" },
      dealId: { type: Schema.Types.ObjectId, ref: "SalesDeal" },
      organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
      convertedAt: Date,
      convertedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    mergedIntoLeadId: { type: Schema.Types.ObjectId, ref: "SalesLead" },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for high-frequency dashboard queries and duplicate detection
LeadSchema.index({ status: 1, assignedOwnerId: 1 });
LeadSchema.index({ status: 1, createdAt: -1 });
LeadSchema.index({ status: 1, updatedAt: 1 });
LeadSchema.index({ score: -1, status: 1 });
LeadSchema.index({ name: "text", companyName: "text", email: "text" });

export const Lead = mongoose.model<ILead>("SalesLead", LeadSchema);
export default Lead;
