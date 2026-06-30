import mongoose, { Schema, Document } from "mongoose";

export interface IQuickLink extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  url: string;
  icon: string;
  order: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuickLinkSchema = new Schema<IQuickLink>(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, ref: "Organization" },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    icon: { type: String, default: "Link" },
    order: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
QuickLinkSchema.index({ organizationId: 1 });
QuickLinkSchema.index({ organizationId: 1, isDeleted: 1 });

export const QuickLink = mongoose.model<IQuickLink>("QuickLink", QuickLinkSchema, "quickLinks");
export default QuickLink;
