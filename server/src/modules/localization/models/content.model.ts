import mongoose, { Schema, Document } from "mongoose";

export type ContentType =
  | "article"
  | "journey"
  | "lesson"
  | "email_template"
  | "help_text"
  | "notification"
  | "generic";

export type ContentStatus = "active" | "archived";

export interface IContent extends Document {
  /** Stable string key used to look up content programmatically, e.g. "kb:article:64abc" */
  key: string;
  type: ContentType;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ContentSchema = new Schema<IContent>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    type: {
      type: String,
      enum: ["article", "journey", "lesson", "email_template", "help_text", "notification", "generic"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "archived"],
      default: "active",
    },
  },
  { timestamps: true }
);

ContentSchema.index({ type: 1 });
ContentSchema.index({ status: 1 });

export const Content = mongoose.model<IContent>("Content", ContentSchema, "i18nContent");
export default Content;
