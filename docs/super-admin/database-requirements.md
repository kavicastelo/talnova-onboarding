# Super Admin Database Models & Schema Requirements

> **Document Status:** Authoritative Database Specification  
> **System:** Talnova Onboarding Enterprise Platform  
> **Database Engine:** MongoDB Atlas via Mongoose v8.8.2  
> **Scope:** New Mongoose Schemas, Model Refactoring, Secondary Indexes, and Aggregation Specifications.

---

## 1. Executive Summary of Database Changes

To remediate discovered gaps and establish an authoritative control plane, the database layer requires:
1. **Refactoring 2 Existing Models:** `Invoice` (expand fields, line items, status lifecycle) and `AuditLog` (make `organizationId` optional, expand categories).
2. **Creating 8 New Enterprise Models:**
   * `PaymentRecord` (`payment_records`): Manual payment receipt ledger with bank references.
   * `ExpenseRecord` (`expense_records`): Manual operational expense ledger.
   * `CustomerAccount` (`customer_accounts`): Commercial terms, credit status, and billing contacts.
   * `AIUsageRecord` (`ai_usage_records`): Token consumption, latency, and cost telemetry.
   * `Alert` (`alerts`): Unified platform incident workbench.
   * `FeatureFlag` (`feature_flags`): Runtime feature rollout configuration.
   * `PlatformEvent` (`platform_events`): Queryable behavior event stream (with 90-day TTL).
   * `SystemMetricDaily` (`system_metrics_daily`): Historical daily rollup buckets.

---

## 2. Granular Schema Specifications

### 2.1 Refactored Invoice Model (`Invoice`)

```typescript
import mongoose, { Schema, Document } from "mongoose";

export interface IInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IInvoice extends Document {
  invoiceNo: string;
  organizationId: mongoose.Types.ObjectId;
  customerName: string;
  currency: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: IInvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: "draft" | "issued" | "sent" | "partially_paid" | "paid" | "overdue" | "cancelled" | "written_off" | "refunded" | "disputed";
  notes?: string;
  terms?: string;
  isDeleted: boolean;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineItemSchema = new Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 }
}, { _id: false });

const InvoiceSchema = new Schema<IInvoice>({
  invoiceNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  customerName: { type: String, required: true, trim: true },
  currency: { type: String, default: "USD", uppercase: true, trim: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  lineItems: { type: [InvoiceLineItemSchema], default: [] },
  subtotal: { type: Number, required: true, default: 0 },
  discountAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balanceDue: { type: Number, required: true, default: 0 },
  status: {
    type: String,
    enum: ["draft", "issued", "sent", "partially_paid", "paid", "overdue", "cancelled", "written_off", "refunded", "disputed"],
    default: "draft",
    index: true
  },
  notes: { type: String },
  terms: { type: String },
  isDeleted: { type: Boolean, default: false, index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

InvoiceSchema.index({ organizationId: 1, status: 1, isDeleted: 1 });
InvoiceSchema.index({ dueDate: 1, balanceDue: 1 });
```

---

### 2.2 PaymentRecord Model (`PaymentRecord`)

```typescript
export interface IPaymentRecord extends Document {
  paymentNo: string;
  invoiceId: mongoose.Types.ObjectId;
  organizationId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: "bank_transfer" | "wire" | "check" | "manual_card" | "other";
  referenceNumber: string; // Bank wire reference or check number
  notes?: string;
  verificationStatus: "verified" | "pending_reconciliation" | "rejected";
  recordedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>({
  paymentNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  invoiceId: { type: Schema.Types.ObjectId, ref: "Invoice", required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: "USD", uppercase: true, trim: true },
  paymentDate: { type: Date, default: Date.now, index: true },
  paymentMethod: {
    type: String,
    enum: ["bank_transfer", "wire", "check", "manual_card", "other"],
    default: "bank_transfer"
  },
  referenceNumber: { type: String, required: true, trim: true, index: true },
  notes: { type: String },
  verificationStatus: {
    type: String,
    enum: ["verified", "pending_reconciliation", "rejected"],
    default: "verified",
    index: true
  },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

PaymentRecordSchema.index({ organizationId: 1, paymentDate: -1 });
```

---

### 2.3 ExpenseRecord Model (`ExpenseRecord`)

```typescript
export interface IExpenseRecord extends Document {
  expenseNo: string;
  category: "infrastructure" | "ai_compute" | "software_licenses" | "salaries" | "marketing" | "office" | "legal" | "other";
  vendor: string;
  amount: number;
  currency: string;
  expenseDate: Date;
  description: string;
  organizationId?: mongoose.Types.ObjectId; // Optional: if directly attributed to an org
  isRecurring: boolean;
  recurringInterval?: "monthly" | "quarterly" | "annual";
  receiptUrl?: string;
  approvalStatus: "approved" | "pending" | "rejected";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseRecordSchema = new Schema<IExpenseRecord>({
  expenseNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  category: {
    type: String,
    enum: ["infrastructure", "ai_compute", "software_licenses", "salaries", "marketing", "office", "legal", "other"],
    required: true,
    index: true
  },
  vendor: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: "USD", uppercase: true, trim: true },
  expenseDate: { type: Date, default: Date.now, index: true },
  description: { type: String, required: true, trim: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization" },
  isRecurring: { type: Boolean, default: false },
  recurringInterval: { type: String, enum: ["monthly", "quarterly", "annual"] },
  receiptUrl: { type: String },
  approvalStatus: { type: String, enum: ["approved", "pending", "rejected"], default: "approved", index: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

ExpenseRecordSchema.index({ category: 1, expenseDate: -1 });
```

---

### 2.4 AIUsageRecord Model (`AIUsageRecord`)

```typescript
export interface IAIUsageRecord extends Document {
  organizationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  feature: "assistant_chat" | "course_builder" | "kb_retrieval" | "test_connection";
  provider: "openai" | "gemini" | "anthropic" | "azure_openai" | "custom";
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latencyMs: number;
  status: "success" | "error";
  errorCode?: string;
  createdAt: Date;
}

const AIUsageRecordSchema = new Schema<IAIUsageRecord>({
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: "User" },
  feature: { type: String, enum: ["assistant_chat", "course_builder", "kb_retrieval", "test_connection"], required: true },
  provider: { type: String, enum: ["openai", "gemini", "anthropic", "azure_openai", "custom"], required: true },
  model: { type: String, required: true },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  estimatedCostUsd: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  status: { type: String, enum: ["success", "error"], default: "success" },
  errorCode: { type: String }
}, { timestamps: { createdAt: true, updatedAt: false } });

AIUsageRecordSchema.index({ organizationId: 1, createdAt: -1 });
AIUsageRecordSchema.index({ provider: 1, model: 1, createdAt: -1 });
```

---

### 2.5 Unified Alert Model (`Alert`)

```typescript
export interface IAlert extends Document {
  alertNo: string;
  category: "security" | "application" | "infrastructure" | "database" | "ai" | "finance" | "onboarding" | "compliance";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  sourceService: string;
  organizationId?: mongoose.Types.ObjectId;
  entityType?: string;
  entityId?: mongoose.Types.ObjectId;
  suggestedRemediation?: string;
  status: "open" | "acknowledged" | "investigating" | "resolved" | "ignored";
  acknowledgedBy?: mongoose.Types.ObjectId;
  acknowledgedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>({
  alertNo: { type: String, required: true, unique: true, uppercase: true },
  category: {
    type: String,
    enum: ["security", "application", "infrastructure", "database", "ai", "finance", "onboarding", "compliance"],
    required: true,
    index: true
  },
  severity: { type: String, enum: ["critical", "high", "medium", "low"], required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  sourceService: { type: String, required: true },
  organizationId: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
  entityType: { type: String },
  entityId: { type: Schema.Types.ObjectId },
  suggestedRemediation: { type: String },
  status: {
    type: String,
    enum: ["open", "acknowledged", "investigating", "resolved", "ignored"],
    default: "open",
    index: true
  },
  acknowledgedBy: { type: Schema.Types.ObjectId, ref: "User" },
  acknowledgedAt: { type: Date },
  resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
  resolvedAt: { type: Date },
  resolutionNotes: { type: String }
}, { timestamps: true });

AlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
```

---

### 2.6 FeatureFlag Model (`FeatureFlag`)

```typescript
export interface IFeatureFlag extends Document {
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  environment: "all" | "production" | "staging" | "development";
  targetAudience: "global" | "organizations" | "roles" | "percentage";
  targetOrganizationIds: mongoose.Types.ObjectId[];
  targetRoles: string[];
  rolloutPercentage: number;
  auditHistory: {
    changedBy: mongoose.Types.ObjectId;
    changedAt: Date;
    previousState: boolean;
    newState: boolean;
    reason: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>({
  key: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  isEnabled: { type: Boolean, default: false, index: true },
  environment: { type: String, enum: ["all", "production", "staging", "development"], default: "all" },
  targetAudience: { type: String, enum: ["global", "organizations", "roles", "percentage"], default: "global" },
  targetOrganizationIds: [{ type: Schema.Types.ObjectId, ref: "Organization" }],
  targetRoles: [String],
  rolloutPercentage: { type: Number, default: 100, min: 0, max: 100 },
  auditHistory: [{
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    changedAt: { type: Date, default: Date.now },
    previousState: { type: Boolean },
    newState: { type: Boolean },
    reason: { type: String }
  }]
}, { timestamps: true });
```
