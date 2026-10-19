import mongoose, { Schema, Document } from "mongoose";

export interface ICampaignTemplate extends Document {
  name: string;
  channel: "email" | "whatsapp";
  subject?: string;
  previewText?: string;
  htmlContent?: string;
  plainTextContent?: string;
  whatsappTemplateName?: string;
  whatsappLanguageCode?: string;
  whatsappCategory?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  whatsappParameters?: string[];
  tags: string[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CampaignTemplateSchema = new Schema<ICampaignTemplate>(
  {
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: ["email", "whatsapp"], required: true, index: true },
    subject: { type: String, trim: true },
    previewText: { type: String, trim: true },
    htmlContent: { type: String },
    plainTextContent: { type: String },
    whatsappTemplateName: { type: String, trim: true },
    whatsappLanguageCode: { type: String, default: "en" },
    whatsappCategory: { type: String, enum: ["MARKETING", "UTILITY", "AUTHENTICATION"], default: "MARKETING" },
    whatsappParameters: [{ type: String }],
    tags: [{ type: String, trim: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

export const CampaignTemplate =
  (mongoose.models["SalesCampaignTemplate"] as mongoose.Model<ICampaignTemplate>) ||
  mongoose.model<ICampaignTemplate>("SalesCampaignTemplate", CampaignTemplateSchema);

if (!mongoose.models["CampaignTemplate"]) {
  mongoose.model("CampaignTemplate", CampaignTemplateSchema);
}

export default CampaignTemplate;
