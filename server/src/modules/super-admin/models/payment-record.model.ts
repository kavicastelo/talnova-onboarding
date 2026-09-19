import mongoose, { Schema, Document } from "mongoose";

export type PaymentMethod =
  | "bank_transfer"
  | "wire"
  | "check"
  | "manual_card"
  | "other";

export type PaymentVerificationStatus =
  | "verified"
  | "pending_reconciliation"
  | "rejected";

export interface IPaymentRecord extends Document {
  paymentNo: string;
  receiptNo?: string; // Virtual / Legacy
  invoiceId?: mongoose.Types.ObjectId;
  invoiceNo?: string;
  organizationId: mongoose.Types.ObjectId;
  organizationName: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  recordedAt?: Date; // Virtual / Legacy
  paymentMethod: PaymentMethod;
  method?: string; // Virtual / Legacy
  referenceNumber: string;
  reference?: string; // Virtual / Legacy
  verificationStatus: PaymentVerificationStatus;
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  recordedByEmail?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    paymentNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: "Invoice",
      required: false,
      index: true,
    },
    invoiceNo: {
      type: String,
      required: false,
      uppercase: true,
      trim: true,
      default: "N/A",
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    organizationName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["bank_transfer", "wire", "check", "manual_card", "other"],
      default: "bank_transfer",
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    verificationStatus: {
      type: String,
      enum: ["verified", "pending_reconciliation", "rejected"],
      default: "verified",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recordedByEmail: {
      type: String,
      trim: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    collection: "payment_records",
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for legacy document compatibility
PaymentRecordSchema.virtual("receiptNo")
  .get(function (this: IPaymentRecord) {
    return this.paymentNo || (this as any)._doc?.receiptNo;
  })
  .set(function (this: IPaymentRecord, val: string) {
    this.paymentNo = val;
  });

PaymentRecordSchema.virtual("method")
  .get(function (this: IPaymentRecord) {
    return this.paymentMethod || (this as any)._doc?.method;
  })
  .set(function (this: IPaymentRecord, val: any) {
    const v = String(val).toLowerCase();
    if (v.includes("wire")) this.paymentMethod = "wire";
    else if (v.includes("check")) this.paymentMethod = "check";
    else if (v.includes("card")) this.paymentMethod = "manual_card";
    else if (v.includes("ach") || v.includes("transfer") || v.includes("bank")) this.paymentMethod = "bank_transfer";
    else this.paymentMethod = "other";
  });

PaymentRecordSchema.virtual("reference")
  .get(function (this: IPaymentRecord) {
    return this.referenceNumber || (this as any)._doc?.reference;
  })
  .set(function (this: IPaymentRecord, val: string) {
    this.referenceNumber = val;
  });

PaymentRecordSchema.virtual("recordedAt")
  .get(function (this: IPaymentRecord) {
    return this.paymentDate || (this as any)._doc?.recordedAt;
  })
  .set(function (this: IPaymentRecord, val: Date) {
    this.paymentDate = val;
  });

// Pre-validate hook for precision rounding and fallbacks
PaymentRecordSchema.pre("validate", function (next) {
  const doc = this as IPaymentRecord;
  if (doc.amount) {
    doc.amount = Math.round((doc.amount + Number.EPSILON) * 100) / 100;
  }
  if (!doc.paymentNo && (doc as any).receiptNo) {
    doc.paymentNo = (doc as any).receiptNo;
  }
  if (!doc.referenceNumber && (doc as any).reference) {
    doc.referenceNumber = (doc as any).reference;
  }
  if (!doc.paymentDate && (doc as any).recordedAt) {
    doc.paymentDate = (doc as any).recordedAt;
  }
  next();
});

// Compound Indexes
PaymentRecordSchema.index({ organizationId: 1, paymentDate: -1 });
PaymentRecordSchema.index({ verificationStatus: 1, paymentDate: 1 });

export const PaymentRecord = mongoose.model<IPaymentRecord>(
  "PaymentRecord",
  PaymentRecordSchema
);

export default PaymentRecord;
