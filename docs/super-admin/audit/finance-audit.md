# Super Admin B2B Finance, Billing & Invoicing Audit

> **Document Status:** Authoritative Finance Audit  
> **System:** Talnova Onboarding Enterprise Platform — Control Plane  
> **Accounting Model:** Deterministic Manual B2B Enterprise Billing (No Gateway Dependencies).  

---

## 1. Executive Summary of Finance Architecture

The Talnova Onboarding platform intentionally operates an **internal manual B2B billing model** rather than relying on black-box automated payment gateways like Stripe or PayPal. Enterprise customers contract with custom terms, paying via bank wires, ACH transfers, or corporate checks.

### Core Architectural Equations:
$$\text{Total Due} = \text{Gross Invoiced} - \text{Discounts} + \text{Taxes}$$
$$\text{Cash Collected} = \sum \text{Verified Payment Receipts}$$
$$\text{Outstanding Receivables} = \text{Total Due} - \text{Cash Collected}$$
$$\text{Net Operating Result} = \text{Cash Collected} - \sum \text{Recorded Expenses}$$

### Summary Verdict:
While the user interface (`SuperAdminFinance.tsx`) and basic CRUD endpoints exist, **critical mathematical disconnects, unmodeled collections, and unconditional status mutations invalidate financial correctness**:
1. **Unconditional Paid State Mutation:** Recording ANY payment amount immediately marks the invoice as `Paid` without calculating outstanding balance due.
2. **Missing Invoicing Fundamentals:** The `Invoice` model lacks line items, tax, discounts, amount paid, and balance due.
3. **Synthetic Scale Factors & Zero Expenses:** Historical MRR is calculated using a synthetic formula, and operating expenses in `/telemetry` are hardcoded to `$0`.
4. **Missing Customer Accounts Model:** No `CustomerAccount` schema exists; `/finance/accounts` is missing from the backend.

---

## 2. Invoicing Subsystem Audit

### 2.1 Model Deficiencies (`invoice.model.ts`)
* Schema contains only 9 flat fields: `invoiceNo`, `organizationId`, `organization`, `amount`, `type`, `status` ("Paid", "Pending", "Overdue"), `dueDate`, `description`, `isDeleted`.
* **Missing Fields:**
  * `currency`: Hardcoded assumption of USD.
  * `lineItems`: Cannot break down items into quantity, description, unit price, and subtotal.
  * `taxAmount` & `discountAmount`: Cannot record corporate discounts or applicable VAT/sales taxes.
  * `amountPaid` & `balanceDue`: Impossible to track partial payments or outstanding balances.
  * `createdBy` & `updatedBy`: Lacks user attribution for compliance.
  * `dueDate`: Stored as a plain string rather than a MongoDB `Date`.

### 2.2 Invoice Creation Workflow
* In `SuperAdminFinance.tsx:134-158`, the creation modal captures only Target Organization, Document Type (`Invoice` vs `Receipt`), Amount, Status, and Description.
* Admins cannot specify a due date, tax, discount, line items, or currency.

---

## 3. Payment Ledger & Reconciliation Audit

### 3.1 Unmodeled Collection Usage
* In `super-admin.routes.ts:1831, 1871`, the backend bypasses Mongoose models, writing directly to `db.collection("payment_records")`.
* No Mongoose schema, validation, or indexes exist for payment receipts.

### 3.2 Unconditional "Paid" Mutation Defect (Critical P0)
* In `super-admin.routes.ts:1893-1898`:
  ```typescript
  if (invoiceNo && invoiceNo !== "N/A") {
    await Invoice.findOneAndUpdate(
      { invoiceNo: invoiceNo.trim() },
      { $set: { status: "Paid" } }
    );
  }
  ```
* **Forensic Failure:**
  1. If an invoice total is $5,000 and a customer submits a partial payment of $500, the system sets the invoice status to `Paid`. The remaining $4,500 disappears from accounts receivable!
  2. If multiple payments are recorded against the same invoice, there is no validation preventing total payments from exceeding the invoice amount.
  3. No partial payment status (`partially_paid`) is supported.

---

## 4. Expense Tracker & Operating Result Audit

### 4.1 Unmodeled Collection Usage
* In `super-admin.routes.ts:1921, 1953`, expenses are read from and written to raw `db.collection("expense_records")`.
* Lacks Mongoose schema validation and approval status tracking.

### 4.2 Operating Result Disconnect in Telemetry
* In `GET /finance/expenses`, real expense documents are retrieved, and `totalExpenses` is correctly summed.
* **HOWEVER**, in `GET /telemetry:195`, `const operatingExpenses = 0`. The telemetry dashboard completely ignores `expense_records`, displaying a net operating result equal to gross cash collected!

---

## 5. Customer Accounts Audit

* **Documented Requirement:** `docs/super-admin/finance-model.md` specifies a dedicated `CustomerAccount` entity tracking credit status, billing contacts, preferred currency, and billing cycles.
* **Implementation Reality:**
  * No `CustomerAccount` Mongoose model exists.
  * `GET /api/v1/super-admin/finance/accounts` does not exist in the backend router.
  * The Accounts tab in `SuperAdminFinance.tsx:871-908` simply renders basic cards from `orgsData` without account balances or credit limits.

---

## 6. Financial Remediation Roadmap

1. **Refactor `Invoice` Model:** Add `lineItems`, `currency`, `subtotal`, `taxAmount`, `discountAmount`, `amountPaid`, `balanceDue`, and migrate `dueDate` to `Date`.
2. **Implement `PaymentRecord` Model:** Add full Mongoose schema and compound indexes.
3. **Implement Deterministic Reconciliation:**
   ```typescript
   const newAmountPaid = invoice.amountPaid + paymentAmount;
   const newBalanceDue = invoice.totalAmount - newAmountPaid;
   const newStatus = newBalanceDue <= 0 ? "paid" : "partially_paid";
   await Invoice.updateOne({ _id: invoice._id }, { $set: { amountPaid: newAmountPaid, balanceDue: newBalanceDue, status: newStatus } });
   ```
4. **Implement `ExpenseRecord` and `CustomerAccount` Models.**
5. **Connect Telemetry to Real Expenses:** Sum `expense_records` in `GET /telemetry` to compute real Net Operating Result.
