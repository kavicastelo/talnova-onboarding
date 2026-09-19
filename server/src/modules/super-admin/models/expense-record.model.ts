import mongoose, { Schema, Document } from "mongoose";

export type ExpenseCategory =
  | "infrastructure"
  | "ai_compute"
  | "software_licenses"
  | "salaries"
  | "marketing"
  | "office"
  | "legal"
  | "other";

export interface IExpenseRecord extends Document {
  expenseNo: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  description: string;
  title?: string; // Virtual / Legacy
  notes?: string; // Virtual / Legacy
  incurredAt?: Date; // Virtual / Legacy
  organizationId?: mongoose.Types.ObjectId;
  isRecurring: boolean;
  receiptUrl?: string;
  createdBy: mongoose.Types.ObjectId;
  createdByEmail?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseRecordSchema = new Schema<IExpenseRecord>(
  {
    expenseNo: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "infrastructure",
        "ai_compute",
        "software_licenses",
        "salaries",
        "marketing",
        "office",
        "legal",
        "other",
      ],
      required: true,
      index: true,
    },
    vendor: {
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
    expenseDate: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: false,
      index: true,
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    receiptUrl: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByEmail: {
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
    collection: "expense_records",
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases for legacy document compatibility
ExpenseRecordSchema.virtual("title")
  .get(function (this: IExpenseRecord) {
    return this.description || (this as any)._doc?.title;
  })
  .set(function (this: IExpenseRecord, val: string) {
    this.description = val;
  });

ExpenseRecordSchema.virtual("notes")
  .get(function (this: IExpenseRecord) {
    return this.description || (this as any)._doc?.notes;
  })
  .set(function (this: IExpenseRecord, val: string) {
    this.description = val;
  });

ExpenseRecordSchema.virtual("incurredAt")
  .get(function (this: IExpenseRecord) {
    return this.expenseDate || (this as any)._doc?.incurredAt;
  })
  .set(function (this: IExpenseRecord, val: Date) {
    this.expenseDate = val;
  });

ExpenseRecordSchema.virtual("date")
  .get(function (this: IExpenseRecord) {
    return this.expenseDate || (this as any)._doc?.date;
  });

// Pre-validate hook for precision rounding and category normalization
ExpenseRecordSchema.pre("validate", function (next) {
  const doc = this as IExpenseRecord;
  if (doc.amount) {
    doc.amount = Math.round((doc.amount + Number.EPSILON) * 100) / 100;
  }

  // Normalize legacy categories if present
  if (doc.category) {
    const catLower = String(doc.category).toLowerCase().trim();
    if (catLower === "hosting" || catLower === "cloud") {
      doc.category = "infrastructure";
    } else if (catLower === "ai" || catLower === "tokens") {
      doc.category = "ai_compute";
    } else if (catLower === "tools" || catLower === "saas") {
      doc.category = "software_licenses";
    } else if (catLower === "hardware") {
      doc.category = "office";
    }
  }

  // Fallbacks for description from title or notes
  if (!doc.description) {
    if ((doc as any).title) doc.description = (doc as any).title;
    else if ((doc as any).notes) doc.description = (doc as any).notes;
  }

  // Fallbacks for expenseDate from incurredAt
  if (!doc.expenseDate && (doc as any).incurredAt) {
    doc.expenseDate = (doc as any).incurredAt;
  }

  next();
});

// Compound Index: Optimize date-range filtering and category breakdown
ExpenseRecordSchema.index({ expenseDate: -1, category: 1 });

export const ExpenseRecord = mongoose.model<IExpenseRecord>(
  "ExpenseRecord",
  ExpenseRecordSchema
);

export default ExpenseRecord;
