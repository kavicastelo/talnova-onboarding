import mongoose, { Schema, Document } from "mongoose";

export interface IInvoice extends Document {
  invoiceNo: string;
  organizationId?: mongoose.Types.ObjectId;
  organization: string;
  amount: number;
  type: "Invoice" | "Receipt";
  status: "Paid" | "Pending" | "Overdue";
  dueDate: string;
  description: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNo: { type: String, required: true, unique: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
    organization: { type: String, required: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ["Invoice", "Receipt"], required: true },
    status: { type: String, enum: ["Paid", "Pending", "Overdue"], required: true },
    dueDate: { type: String, required: true },
    description: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

InvoiceSchema.index({ organizationId: 1, isDeleted: 1 });
InvoiceSchema.index({ invoiceNo: 1 }, { unique: true });

export const Invoice = mongoose.model<IInvoice>("Invoice", InvoiceSchema);
export default Invoice;
