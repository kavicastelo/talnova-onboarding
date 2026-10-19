import mongoose, { Schema, Document } from "mongoose";

export interface IContactConsent {
  emailMarketing: boolean;
  whatsappMarketing: boolean;
  consentTimestamp?: Date;
  consentSource?: string;
  optedOutAt?: Date;
}

export interface IContact extends Document {
  companyId?: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  normalizedEmail: string;
  phone?: string;
  normalizedPhone?: string;
  whatsapp?: string;
  jobTitle?: string;
  role: "buyer" | "evaluator" | "technical_contact" | "approver" | "admin" | "other";
  isPrimaryDecisionMaker: boolean;
  consent: IContactConsent;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ContactSchema = new Schema<IContact>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "SalesCompany", index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    fullName: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, trim: true },
    normalizedEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    normalizedPhone: { type: String, trim: true, index: true },
    whatsapp: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    role: {
      type: String,
      enum: ["buyer", "evaluator", "technical_contact", "approver", "admin", "other"],
      default: "evaluator",
      index: true,
    },
    isPrimaryDecisionMaker: { type: Boolean, default: false, index: true },
    consent: {
      emailMarketing: { type: Boolean, default: false },
      whatsappMarketing: { type: Boolean, default: false },
      consentTimestamp: Date,
      consentSource: String,
      optedOutAt: Date,
    },
    tags: [{ type: String, trim: true, index: true }],
  },
  {
    timestamps: true,
  }
);

ContactSchema.index({ companyId: 1, isPrimaryDecisionMaker: 1 });
ContactSchema.index({ fullName: "text", email: "text" });

export const Contact = mongoose.model<IContact>("SalesContact", ContactSchema);
export default Contact;
