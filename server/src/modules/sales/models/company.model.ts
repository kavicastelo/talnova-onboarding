import mongoose, { Schema, Document } from "mongoose";

export interface ICompanyNote {
  content: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
}

export interface ICompany extends Document {
  name: string;
  domain: string;
  website?: string;
  industry?: string;
  employeeCount?: number;
  country?: string;
  region?: string;
  annualRevenuePotential?: number;
  currency: string;
  tier: "starter" | "growth" | "enterprise" | "strategic";
  status: "prospect" | "qualified" | "customer" | "inactive" | "former_customer";
  accountOwnerId?: mongoose.Types.ObjectId;
  convertedOrganizationId?: mongoose.Types.ObjectId;
  tags: string[];
  notes: ICompanyNote[];
  createdAt: Date;
  updatedAt: Date;
}

const CompanyNoteSchema = new Schema<ICompanyNote>({
  content: { type: String, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

const CompanySchema = new Schema<ICompany>(
  {
    name: { type: String, required: true, trim: true, index: true },
    domain: { type: String, required: true, trim: true, lowercase: true, index: true },
    website: { type: String, trim: true },
    industry: { type: String, trim: true, index: true },
    employeeCount: { type: Number },
    country: { type: String, trim: true },
    region: { type: String, trim: true },
    annualRevenuePotential: { type: Number, default: 0 },
    currency: { type: String, default: "USD" },
    tier: {
      type: String,
      enum: ["starter", "growth", "enterprise", "strategic"],
      default: "enterprise",
      index: true,
    },
    status: {
      type: String,
      enum: ["prospect", "qualified", "customer", "inactive", "former_customer"],
      default: "prospect",
      index: true,
    },
    accountOwnerId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    convertedOrganizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    tags: [{ type: String, trim: true, index: true }],
    notes: [CompanyNoteSchema],
  },
  {
    timestamps: true,
  }
);

CompanySchema.index({ domain: 1, status: 1 });
CompanySchema.index({ name: "text", domain: "text" });

export const Company = mongoose.model<ICompany>("SalesCompany", CompanySchema);
export default Company;
