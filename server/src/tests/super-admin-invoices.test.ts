import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";

describe("Super Admin Invoices Suite: SA-FIN-001 Enterprise Accounting & Line Items", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;
  const createdInvoiceIds: mongoose.Types.ObjectId[] = [];

  const testPrefix = `sa-inv-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `FinTech Holdings ${testPrefix}`,
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
        email: `finance-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Finance",
        lastName: "Administrator",
        fullName: "Finance Administrator",
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
        email: `analyst-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Test",
        lastName: "Analyst",
        fullName: "Test Analyst",
      },
      employment: {
        department: "Operations",
        jobTitle: "Analyst",
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
    if (createdInvoiceIds.length > 0) {
      await Invoice.deleteMany({ _id: { $in: createdInvoiceIds } });
    }
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("payment_records").deleteMany({
        reference: { $regex: testPrefix },
      });
    }
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

  it("1. Create invoice with 3 line items and verify 2-decimal rounded subtotal and totalAmount", async () => {
    const issueDate = new Date();
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const lineItems = [
      { description: "50 Seat Licenses", quantity: 50, unitPrice: 20.0 }, // 1000.00
      { description: "1 Enterprise SLA Pack", quantity: 1, unitPrice: 500.0 }, // 500.00
      { description: "5 Dedicated IP Addresses", quantity: 5, unitPrice: 25.5 }, // 127.50
    ];

    const discountAmount = 162.75;
    const taxAmount = 117.18;

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/invoices",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        customerName: testOrg.name,
        currency: "USD",
        issueDate: issueDate.toISOString(),
        dueDate: dueDate.toISOString(),
        lineItems,
        discountAmount,
        taxAmount,
        notes: `Contract Reference #${testPrefix}`,
        type: "Invoice",
        status: "issued",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const inv = body.data;
    createdInvoiceIds.push(new mongoose.Types.ObjectId(inv.id));

    // Verify mathematical calculations
    // Subtotal: 1000 + 500 + 127.50 = 1627.50
    expect(inv.subtotal).toBe(1627.5);
    // Total Amount: 1627.50 - 162.75 + 117.18 = 1581.93
    expect(inv.totalAmount).toBe(1581.93);
    // Balance Due matches total amount initially
    expect(inv.balanceDue).toBe(1581.93);
    expect(inv.amountPaid).toBe(0);
    expect(inv.lineItems).toHaveLength(3);
    expect(inv.lineItems[0].amount).toBe(1000);
    expect(inv.lineItems[1].amount).toBe(500);
    expect(inv.lineItems[2].amount).toBe(127.5);
  });

  it("2. Verify native MongoDB Date comparison querying for dueDate", async () => {
    const now = new Date();
    const futureDate15 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const futureDate45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const invoiceInWindow = await Invoice.create({
      invoiceNo: `INV-DATE-1-${Date.now()}`,
      organizationId: testOrg._id,
      customerName: "Date Match Corp",
      dueDate: futureDate15,
      issueDate: now,
      lineItems: [{ description: "Service A", quantity: 1, unitPrice: 100, amount: 100 }],
      subtotal: 100,
      totalAmount: 100,
      balanceDue: 100,
      status: "issued",
      type: "Invoice",
    });
    createdInvoiceIds.push(invoiceInWindow._id as mongoose.Types.ObjectId);

    const invoiceOutOfWindow = await Invoice.create({
      invoiceNo: `INV-DATE-2-${Date.now()}`,
      organizationId: testOrg._id,
      customerName: "Date Out Corp",
      dueDate: futureDate45,
      issueDate: now,
      lineItems: [{ description: "Service B", quantity: 1, unitPrice: 200, amount: 200 }],
      subtotal: 200,
      totalAmount: 200,
      balanceDue: 200,
      status: "issued",
      type: "Invoice",
    });
    createdInvoiceIds.push(invoiceOutOfWindow._id as mongoose.Types.ObjectId);

    // Query using native MongoDB Date comparison ($gte, $lte)
    const rangeStart = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    const rangeEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

    const results = await Invoice.find({
      organizationId: testOrg._id,
      dueDate: { $gte: rangeStart, $lte: rangeEnd },
      isDeleted: false,
    });

    const matchedIds = results.map((r) => r._id.toString());
    expect(matchedIds).toContain(invoiceInWindow._id.toString());
    expect(matchedIds).not.toContain(invoiceOutOfWindow._id.toString());
  });

  it("3. Reject invoice creation if dueDate is earlier than issueDate (HTTP 400)", async () => {
    const now = new Date();
    const earlierDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/invoices",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        customerName: testOrg.name,
        issueDate: now.toISOString(),
        dueDate: earlierDate.toISOString(), // earlier than issueDate!
        lineItems: [{ description: "Platform Service", quantity: 1, unitPrice: 100 }],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/earlier than issue date/i);
  });

  it("4. Reject invoice creation if line items array is empty (HTTP 400)", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/invoices",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        customerName: testOrg.name,
        lineItems: [], // empty line items
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/at least one line item/i);
  });

  it("5. Retrieve itemized invoice dossier and linked payment records via GET /invoices/:id", async () => {
    const testInv = await Invoice.create({
      invoiceNo: `INV-DOSSIER-${Date.now()}`,
      organizationId: testOrg._id,
      customerName: "Dossier Enterprise",
      currency: "EUR",
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      issueDate: new Date(),
      lineItems: [
        { description: "Custom AI Module", quantity: 2, unitPrice: 450, amount: 900 },
        { description: "API Integration SLA", quantity: 1, unitPrice: 200, amount: 200 },
      ],
      subtotal: 1100,
      totalAmount: 1100,
      balanceDue: 1100,
      status: "issued",
      notes: "Net 14 payment terms",
      type: "Invoice",
    });
    createdInvoiceIds.push(testInv._id as mongoose.Types.ObjectId);

    // Record verified payment linked to this invoice
    const db = mongoose.connection.db;
    if (db) {
      await db.collection("payment_records").insertOne({
        receiptNo: `REC-${Date.now()}`,
        invoiceNo: testInv.invoiceNo,
        organizationName: "Dossier Enterprise",
        organizationId: testOrg._id,
        amount: 500,
        method: "Bank Wire",
        reference: `REF-${testPrefix}`,
        notes: "Part 1 of 2 wire transfer",
        recordedAt: new Date(),
        recordedBy: "Super Admin",
      });
    }

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/invoices/${testInv._id}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.invoice.invoiceNo).toBe(testInv.invoiceNo);
    expect(body.data.invoice.lineItems).toHaveLength(2);
    expect(body.data.invoice.currency).toBe("EUR");
    expect(body.data.payments).toHaveLength(1);
    expect(body.data.payments[0].amount).toBe(500);
    expect(body.data.payments[0].reference).toBe(`REF-${testPrefix}`);
  });

  it("6. Verify partial and full payment recording updates balanceDue and invoice lifecycle status", async () => {
    const testInv = await Invoice.create({
      invoiceNo: `INV-PAY-CYCLE-${Date.now()}`,
      organizationId: testOrg._id,
      customerName: "Cycle Corp",
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      issueDate: new Date(),
      lineItems: [{ description: "Cloud Infrastructure Setup", quantity: 1, unitPrice: 2000, amount: 2000 }],
      subtotal: 2000,
      totalAmount: 2000,
      balanceDue: 2000,
      amountPaid: 0,
      status: "issued",
      type: "Invoice",
    });
    createdInvoiceIds.push(testInv._id as mongoose.Types.ObjectId);

    // Record partial payment of $750
    const partialRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        organizationName: "Cycle Corp",
        amount: 750,
        invoiceNo: testInv.invoiceNo,
        reference: `REF-PARTIAL-${testPrefix}`,
        method: "Credit Card",
      },
    });
    expect(partialRes.statusCode).toBe(201);

    const updatedAfterPartial = await Invoice.findById(testInv._id);
    expect(updatedAfterPartial?.amountPaid).toBe(750);
    expect(updatedAfterPartial?.balanceDue).toBe(1250);
    expect(updatedAfterPartial?.status).toBe("partially_paid");

    // Record remaining payment of $1250
    const fullRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/payments",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        organizationId: testOrg._id.toString(),
        organizationName: "Cycle Corp",
        amount: 1250,
        invoiceNo: testInv.invoiceNo,
        reference: `REF-FULL-${testPrefix}`,
        method: "Bank Wire",
      },
    });
    expect(fullRes.statusCode).toBe(201);

    const updatedAfterFull = await Invoice.findById(testInv._id);
    expect(updatedAfterFull?.amountPaid).toBe(2000);
    expect(updatedAfterFull?.balanceDue).toBe(0);
    expect(updatedAfterFull?.status).toBe("paid");
  });

  it("7. Support legacy invoice documents with fallback virtual getters and list queries", async () => {
    // Seed raw legacy invoice without lineItems, using legacy 'organization' and 'amount'
    const legacyInv = await Invoice.create({
      invoiceNo: `INV-LEGACY-${Date.now()}`,
      organizationId: testOrg._id,
      customerName: "Legacy Global Ltd",
      organization: "Legacy Global Ltd",
      amount: 450,
      totalAmount: 450,
      subtotal: 450,
      balanceDue: 450,
      status: "Pending",
      type: "Invoice",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      description: "Legacy flat maintenance charge",
    });
    createdInvoiceIds.push(legacyInv._id as mongoose.Types.ObjectId);

    // Verify virtuals work on Mongoose document
    expect(legacyInv.organization).toBe("Legacy Global Ltd");
    expect(legacyInv.amount).toBe(450);

    // Verify GET /invoices returns it cleanly and handles search
    const listRes = await app.inject({
      method: "GET",
      url: `/api/v1/super-admin/invoices?search=${legacyInv.invoiceNo}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(listRes.statusCode).toBe(200);
    const body = JSON.parse(listRes.body);
    expect(body.data.invoices.data).toHaveLength(1);
    const item = body.data.invoices.data[0];
    expect(item.invoiceNo).toBe(legacyInv.invoiceNo);
    expect(item.amount).toBe(450);
    expect(item.customerName).toBe("Legacy Global Ltd");
  });

  it("8. Reject non-super-admin user access (HTTP 403)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/invoices",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });
});
