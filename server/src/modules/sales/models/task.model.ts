import mongoose, { Schema, Document } from "mongoose";

export interface ISalesTask extends Document {
  title: string;
  description?: string;
  type: "call" | "meeting" | "email" | "demo" | "proposal" | "follow_up" | "other";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: Date;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  assignedTo?: mongoose.Types.ObjectId;
  leadId?: mongoose.Types.ObjectId;
  contactId?: mongoose.Types.ObjectId;
  companyId?: mongoose.Types.ObjectId;
  dealId?: mongoose.Types.ObjectId;
  outcomeNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesTaskSchema = new Schema<ISalesTask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    type: {
      type: String,
      enum: ["call", "meeting", "email", "demo", "proposal", "follow_up", "other"],
      default: "follow_up",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    dueDate: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "SalesLead", index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "SalesContact", index: true },
    companyId: { type: Schema.Types.ObjectId, ref: "SalesCompany", index: true },
    dealId: { type: Schema.Types.ObjectId, ref: "SalesDeal", index: true },
    outcomeNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

SalesTaskSchema.index({ status: 1, dueDate: 1 });
SalesTaskSchema.index({ assignedTo: 1, status: 1, dueDate: 1 });

export const SalesTask = mongoose.model<ISalesTask>("SalesTask", SalesTaskSchema);
export default SalesTask;
