import mongoose, { Schema, Document } from "mongoose";

export interface ISuppression extends Document {
  identifier: string;
  type: "email" | "phone";
  reason: "unsubscribe" | "hard_bounce" | "spam_complaint" | "manual";
  source?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const SuppressionSchema = new Schema<ISuppression>(
  {
    identifier: { type: String, required: true, trim: true, lowercase: true, index: true },
    type: { type: String, enum: ["email", "phone"], required: true, index: true },
    reason: {
      type: String,
      enum: ["unsubscribe", "hard_bounce", "spam_complaint", "manual"],
      default: "unsubscribe",
      index: true,
    },
    source: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

SuppressionSchema.index({ identifier: 1, type: 1 }, { unique: true });

export const Suppression =
  (mongoose.models["SalesSuppression"] as mongoose.Model<ISuppression>) ||
  mongoose.model<ISuppression>("SalesSuppression", SuppressionSchema);

export default Suppression;
