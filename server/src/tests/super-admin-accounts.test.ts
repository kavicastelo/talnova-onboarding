import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import CustomerAccount from "../modules/super-admin/models/customer-account.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Super Admin Customer Accounts Suite: SA-FIN-004 Commercial Billing Tiers & Standing", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdInvoiceIds: mongoose.Types.ObjectId[] = [];

  const testPrefix = `sa-acc-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Baseline Organization
    testOrg = await Organization.create({
      name: `Commercial Corp ${testPrefix}`,
      slug: `commercial-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `commercial-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Commercial",
        lastName: "Admin",
        fullName: "Commercial Admin",
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
        email: `commercial-staff-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Commercial",
        lastName: "Staff",
        fullName: "Commercial Staff",
      },
      employment: {
        department: "Sales",
        jobTitle: "Associate",
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
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
      await CustomerAccount.deleteMany({ organizationId: { $in: createdOrgIds } });
    }
    if (createdInvoiceIds.length > 0) {
      await Invoice.deleteMany({ _id: { $in: createdInvoiceIds } });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
    await app.close();
  });

  let provisionedOrgId: string;
  let provisionedAccountId: string;

  it("1. Provision tenant via POST /organizations -> verify CustomerAccount automatically created in good_standing", async () => {
    const orgName = `AutoAccount Org ${testPrefix}`;
    const adminEmail = `owner-${testPrefix}@autoaccount.test`;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/organizations",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: orgName,
        adminEmail,
        plan: "Enterprise",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    provisionedOrgId = body.data.id;
    createdOrgIds.push(new mongoose.Types.ObjectId(provisionedOrgId));

    // Verify CustomerAccount created in MongoDB
    const customerAccount = await CustomerAccount.findOne({
      organizationId: new mongoose.Types.ObjectId(provisionedOrgId),
    });
    expect(customerAccount).toBeDefined();
    expect(customerAccount?.accountStatus).toBe("good_standing");
    expect(customerAccount?.billingCycle).toBe("monthly");
    expect(customerAccount?.preferredCurrency).toBe("USD");
    expect(customerAccount?.creditLimit).toBe(0);
    expect(customerAccount?.billingContact.email).toBe(adminEmail);

    provisionedAccountId = customerAccount!._id.toString();
  });

  it("2. GET /finance/accounts -> verify populated organization, default balances and account details", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/accounts",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(2);

    const account = body.data.find(
      (a: any) =>
        a.organizationId?.id === provisionedOrgId ||
        a.organizationId?._id === provisionedOrgId ||
        a.organization?.id === provisionedOrgId
    );
    expect(account).toBeDefined();
    expect(account.accountStatus).toBe("good_standing");
    expect(account.totalBalanceDue).toBe(0);
    expect(account.totalInvoiced).toBe(0);
    expect(account.totalPaid).toBe(0);
    expect(account.organization.name).toContain("AutoAccount Org");
  });

  it("3. Deterministic Balance Due: Create an invoice with balance due and verify aggregation in GET /finance/accounts", async () => {
    // Create an invoice with $3,000 total and $1,000 paid -> $2,000 balance due
    const invoice = await Invoice.create({
      invoiceNo: `INV-${testPrefix}-001`,
      organizationId: new mongoose.Types.ObjectId(provisionedOrgId),
      customerName: "AutoAccount Org",
      type: "Invoice",
      status: "issued",
      subtotal: 3000,
      totalAmount: 3000,
      amountPaid: 1000,
      balanceDue: 2000,
      currency: "USD",
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lineItems: [{ description: "Enterprise Cloud Subscription", quantity: 1, unitPrice: 3000, amount: 3000 }],
      isDeleted: false,
    });
    createdInvoiceIds.push(invoice._id);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/accounts",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    const account = body.data.find(
      (a: any) =>
        a.organizationId?.id === provisionedOrgId ||
        a.organizationId?._id === provisionedOrgId ||
        a.organization?.id === provisionedOrgId
    );
    expect(account).toBeDefined();
    expect(account.totalInvoiced).toBe(3000);
    expect(account.totalPaid).toBe(1000);
    expect(account.totalBalanceDue).toBe(2000);
  });

  it("4. PATCH /finance/accounts/:id -> update accountStatus to credit_hold and set creditLimit", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedAccountId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        accountStatus: "credit_hold",
        billingCycle: "annual",
        creditLimit: 25000,
        commercialNotes: "Escalated to legal: 60 days overdue payment.",
        billingContact: {
          name: "Chief Financial Officer",
          email: "cfo@autoaccount.test",
          phone: "+1-555-0199",
          address: "100 Financial Way, New York, NY",
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accountStatus).toBe("credit_hold");
    expect(body.data.billingCycle).toBe("annual");
    expect(body.data.creditLimit).toBe(25000);
    expect(body.data.billingContact.name).toBe("Chief Financial Officer");
    expect(body.data.commercialNotes).toBe("Escalated to legal: 60 days overdue payment.");

    // Verify persisted in MongoDB
    const updated = await CustomerAccount.findById(provisionedAccountId);
    expect(updated?.accountStatus).toBe("credit_hold");
    expect(updated?.creditLimit).toBe(25000);
    expect(updated?.billingCycle).toBe("annual");
  });

  it("5. Verify CUSTOMER_ACCOUNT_UPDATED audit log was recorded with metadata", async () => {
    const auditLog = await AuditLog.findOne({
      resourceType: "CustomerAccount",
      resourceId: new mongoose.Types.ObjectId(provisionedAccountId),
      eventType: "CUSTOMER_ACCOUNT_UPDATED",
    });

    expect(auditLog).toBeDefined();
    expect(auditLog?.eventCategory).toBe("finance");
    expect(auditLog?.action).toBe("update");
    expect(auditLog?.metadata?.previousStatus).toBe("good_standing");
    expect(auditLog?.metadata?.newStatus).toBe("credit_hold");
    expect(auditLog?.metadata?.newCreditLimit).toBe(25000);
  });

  it("6. Update account status to VIP via organizationId lookup parameter", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedOrgId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        accountStatus: "vip",
        creditLimit: 50000,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.accountStatus).toBe("vip");
    expect(body.data.creditLimit).toBe(50000);
  });

  it("7. Validation: Rejects invalid accountStatus and negative creditLimit with 400 BAD_REQUEST", async () => {
    // Invalid status
    const res1 = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedAccountId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        accountStatus: "bankrupt",
      },
    });
    expect(res1.statusCode).toBe(400);

    // Negative credit limit
    const res2 = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedAccountId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        creditLimit: -500,
      },
    });
    expect(res2.statusCode).toBe(400);

    // Invalid billing cycle
    const res3 = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedAccountId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        billingCycle: "biweekly",
      },
    });
    expect(res3.statusCode).toBe(400);
  });

  it("8. Rejects non-existent customer account with 404 NOT_FOUND", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${fakeId}`,
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        accountStatus: "good_standing",
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it("9. Filter accounts by status query param (status=vip)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/accounts?status=vip",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.every((a: any) => a.accountStatus === "vip")).toBe(true);
    const hasProvisioned = body.data.some(
      (a: any) => a.organization.id === provisionedOrgId
    );
    expect(hasProvisioned).toBe(true);
  });

  it("10. RBAC: Non-admin employee receives 403 Forbidden", async () => {
    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/accounts",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
    });
    expect(getRes.statusCode).toBe(403);

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/v1/super-admin/finance/accounts/${provisionedAccountId}`,
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
      payload: {
        accountStatus: "vip",
      },
    });
    expect(patchRes.statusCode).toBe(403);
  });
});
