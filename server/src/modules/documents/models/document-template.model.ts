import mongoose, { Schema, Document } from "mongoose";

export interface IDocumentTemplate extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: "nda" | "code_of_conduct" | "offer_letter" | "handbook" | "direct_deposit" | "custom";
  content: string; // Rich HTML/Markdown template content with {{variable}} placeholders
  signatureRequired: boolean;
  version: number;
  audience: {
    departmentNames?: string[];
    jobTitleNames?: string[];
    locations?: string[];
    autoAssignNewHires?: boolean;
  };
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentTemplateSchema = new Schema<IDocumentTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    category: {
      type: String,
      enum: ["nda", "code_of_conduct", "offer_letter", "handbook", "direct_deposit", "custom"],
      default: "custom",
    },
    content: { type: String, required: true },
    signatureRequired: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    audience: {
      departmentNames: { type: [String], default: [] },
      jobTitleNames: { type: [String], default: [] },
      locations: { type: [String], default: [] },
      autoAssignNewHires: { type: Boolean, default: false },
    },
    createdBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

DocumentTemplateSchema.index({ organizationId: 1, isDeleted: 1 });
DocumentTemplateSchema.index({ organizationId: 1, category: 1 });

export const DocumentTemplate = mongoose.model<IDocumentTemplate>("DocumentTemplate", DocumentTemplateSchema);
export default DocumentTemplate;
