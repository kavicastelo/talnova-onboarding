import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";
import PaymentRecord from "../modules/super-admin/models/payment-record.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Super Admin Payments Suite: SA-FIN-002 PaymentRecord Schema & Deterministic Balance Reconciliation", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;
  const createdInvoiceIds: mongoose.Types.ObjectId[] = [];
  const createdPaymentIds: mongoose.Types.ObjectId[] = [];

  const testPrefix = `sa-pay-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `FinTech Global ${testPrefix}`,
      slug: `fintech-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `payments-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Billing",
        lastName: "Administrator",
        fullName: "Billing Administrator",
      },
      employment: {
        department: "Finance",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
      },
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Create Non-Admin User for RBAC testing
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Employee",
        fullName: "Regular Employee",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Developer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    nonAdminToken = app.jwt.sign({
      userId: nonAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await PaymentRecord.deleteMany({ _id: { $in: createdPaymentIds } });
    }
    if (createdInvoiceIds.length > 0) {
      await Invoice.deleteMany({ _id: { $in: createdInvoiceIds } });
    }
    await AuditLog.deleteMany({
      actorUserId: superAdminUser?._id,
      eventType: "PAYMENT_RECORDED",
    });
    if (testOrg) {
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
    await app.close();
  });

  let primaryInvoice: any;

  it("1. Setup an enterprise invoice with $1000 balance for reconciliation testing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/invoices",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        customerName: testOrg.name,
        currency: "USD",
        issueDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lineItems: [
          { description: "10 Dedicated Compute Instances", quantity: 10, unitPrice: 100.0 },
        ],
        discountAmount: 0,
        taxAmount: 0,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    primaryInvoice = body.data;
    createdInvoiceIds.push(new mongoose.Types.ObjectId(primaryInvoice.id));

    expect(primaryInvoice.totalAmount).toBe(1000);
    expect(primaryInvoice.amountPaid).toBe(0);
    expect(primaryInvoice.balanceDue).toBe(1000);
    expect(primaryInvoice.status).toBe("issued");
  });

  it("2. Record partial payment ($400): updates amountPaid=400, balanceDue=600, status=partially_paid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        invoiceId: primaryInvoice.id,
        invoiceNo: primaryInvoice.invoiceNo,
        amount: 400.0,
        paymentMethod: "wire",
        referenceNumber: `WIRE-PARTIAL-${testPrefix}`,
        notes: "First installment via SWIFT wire transfer",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.receiptNo).toMatch(/^REC-\d+-\d+$/);
    expect(body.data.amount).toBe(400);
    createdPaymentIds.push(new mongoose.Types.ObjectId(body.data.id));

    // Verify invoice directly in database
    const dbInvoice = await Invoice.findById(primaryInvoice.id);
    expect(dbInvoice).toBeDefined();
    expect(dbInvoice!.amountPaid).toBe(400);
    expect(dbInvoice!.balanceDue).toBe(600);
    expect(dbInvoice!.status).toBe("partially_paid");

    // Verify PaymentRecord directly in database
    const dbPayment = await PaymentRecord.findById(body.data.id);
    expect(dbPayment).toBeDefined();
    expect(dbPayment!.invoiceNo).toBe(primaryInvoice.invoiceNo);
    expect(dbPayment!.amount).toBe(400);
    expect(dbPayment!.paymentMethod).toBe("wire");
    expect(dbPayment!.referenceNumber).toBe(`WIRE-PARTIAL-${testPrefix}`);
    expect(dbPayment!.recordedBy.toString()).toBe(superAdminUser._id.toString());
  });

  it("3. Reject overpayment attempt: paying $700 when remaining balance is $600 returns HTTP 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        invoiceId: primaryInvoice.id,
        invoiceNo: primaryInvoice.invoiceNo,
        amount: 700.0,
        paymentMethod: "manual_card",
        referenceNumber: `CC-OVER-${testPrefix}`,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.message).toContain("exceeds invoice balance due");

    // Verify invoice was not altered
    const dbInvoice = await Invoice.findById(primaryInvoice.id);
    expect(dbInvoice!.amountPaid).toBe(400);
    expect(dbInvoice!.balanceDue).toBe(600);
    expect(dbInvoice!.status).toBe("partially_paid");
  });

  it("4. Record remaining balance payment ($600): updates amountPaid=1000, balanceDue=0, status=paid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        invoiceId: primaryInvoice.id,
        invoiceNo: primaryInvoice.invoiceNo,
        amount: 600.0,
        paymentMethod: "bank_transfer",
        referenceNumber: `ACH-FINAL-${testPrefix}`,
        notes: "Settling final remaining balance",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.amount).toBe(600);
    createdPaymentIds.push(new mongoose.Types.ObjectId(body.data.id));

    // Verify invoice directly in database
    const dbInvoice = await Invoice.findById(primaryInvoice.id);
    expect(dbInvoice!.amountPaid).toBe(1000);
    expect(dbInvoice!.balanceDue).toBe(0);
    expect(dbInvoice!.status).toBe("paid");
  });

  it("5. Reject payment against already fully paid invoice: returns HTTP 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        invoiceId: primaryInvoice.id,
        invoiceNo: primaryInvoice.invoiceNo,
        amount: 50.0,
        paymentMethod: "check",
        referenceNumber: `CHK-EXTRA-${testPrefix}`,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/already fully paid/i);
  });

  it("6. Reject payment when invoice cannot be found: returns HTTP 404", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        invoiceId: fakeId.toString(),
        invoiceNo: "INV-NONEXISTENT-9999",
        amount: 100.0,
        paymentMethod: "wire",
        referenceNumber: `WIRE-FAKE-${testPrefix}`,
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/not found/i);
  });

  it("7. Verify AuditLog entry has eventType PAYMENT_RECORDED and accurate balance metadata", async () => {
    const auditLogs = await AuditLog.find({
      actorUserId: superAdminUser._id,
      eventType: "PAYMENT_RECORDED",
    }).sort({ createdAt: -1 });

    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    const latestLog = auditLogs[0];
    expect(latestLog.resourceType).toBe("PaymentRecord");
    expect(latestLog.metadata).toBeDefined();
    expect(latestLog.metadata?.invoiceNo).toBe(primaryInvoice.invoiceNo);
    expect(latestLog.metadata?.amount).toBe(600);
    expect(latestLog.metadata?.previousBalance).toBe(600);
    expect(latestLog.metadata?.newBalance).toBe(0);
  });

  it("8. Verify GET /invoices/:id detail includes both payment receipts", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/invoices/${primaryInvoice.id}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.invoice).toBeDefined();
    expect(body.data.invoice.status).toBe("paid");
    expect(body.data.payments).toBeDefined();
    expect(Array.isArray(body.data.payments)).toBe(true);
    expect(body.data.payments.length).toBe(2);

    const amounts = body.data.payments.map((p: any) => p.amount).sort();
    expect(amounts).toEqual([400, 600]);
  });

  it("9. Verify GET /finance/payments returns payment records list and totalCollected", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.payments).toBeDefined();
    expect(Array.isArray(body.data.payments)).toBe(true);
    expect(body.data.totalCollected).toBeGreaterThanOrEqual(1000);

    const found = body.data.payments.find((p: any) => p.referenceNumber === `WIRE-PARTIAL-${testPrefix}`);
    expect(found).toBeDefined();
    expect(found.amount).toBe(400);
    expect(found.invoiceNo).toBe(primaryInvoice.invoiceNo);
  });

  it("10. Enforce RBAC: Non-super-admin user receives HTTP 403 Forbidden when recording payments", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
      payload: {
        invoiceId: primaryInvoice.id,
        invoiceNo: primaryInvoice.invoiceNo,
        amount: 100.0,
        paymentMethod: "wire",
        referenceNumber: `WIRE-UNAUTH-${testPrefix}`,
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.error || body.message).toMatch(/Forbidden|super_admin/i);
  });
});
