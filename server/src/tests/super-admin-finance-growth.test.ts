import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";
import PaymentRecord from "../modules/super-admin/models/payment-record.model.js";

describe("Super Admin Finance Historical Telemetry Suite: SA-ANA-001 Eliminate Synthetic Multipliers", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;

  const testPrefix = `sa-ana-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdInvoiceIds: mongoose.Types.ObjectId[] = [];
  const createdPaymentIds: mongoose.Types.ObjectId[] = [];

  const now = new Date();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Helper date for 2 months ago (mid-month)
  const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 15, 12, 0, 0);
  const twoMonthsAgoLabel = monthNames[twoMonthsAgoDate.getMonth()];

  // Helper date for 3 months ago
  const threeMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 3, 15, 12, 0, 0);
  const threeMonthsAgoLabel = monthNames[threeMonthsAgoDate.getMonth()];

  // Helper date for 1 month ago
  const oneMonthAgoDate = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12, 0, 0);
  const oneMonthAgoLabel = monthNames[oneMonthAgoDate.getMonth()];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Growth Telemetry Org ${testPrefix}`,
      slug: `growth-org-${testPrefix}`,
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
        email: `growth-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Growth",
        lastName: "Admin",
        fullName: "Growth Admin",
      },
      employment: {
        department: "Finance",
        jobTitle: "Super Admin",
        status: "active",
      },
      permissions: {
        role: "super_admin",
        permissions: ["all"],
      },
      isDeleted: false,
    });

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });

    // 3. Seed invoice paid 2 months ago for $500
    const inv2MonthsAgo = await Invoice.create({
      invoiceNo: `INV-${Date.now()}-2M`,
      organizationId: testOrg._id,
      customerName: `Customer ${testPrefix}`,
      currency: "USD",
      amount: 500,
      totalAmount: 500,
      subtotal: 500,
      amountPaid: 500,
      balanceDue: 0,
      status: "Paid",
      type: "Invoice",
      dueDate: twoMonthsAgoDate,
      issueDate: twoMonthsAgoDate,
      createdAt: twoMonthsAgoDate,
      lineItems: [
        {
          description: "Monthly Pro Subscription",
          quantity: 1,
          unitPrice: 500,
          amount: 500,
        },
      ],
      isDeleted: false,
    });
    createdInvoiceIds.push(inv2MonthsAgo._id);

    // 4. Seed an unlinked verified payment receipt 1 month ago for $350
    const payment1MonthAgo = await PaymentRecord.create({
      paymentNo: `PAY-${Date.now()}-1M`,
      organizationId: testOrg._id,
      organizationName: testOrg.name,
      amount: 350,
      currency: "USD",
      paymentDate: oneMonthAgoDate,
      createdAt: oneMonthAgoDate,
      paymentMethod: "bank_transfer",
      referenceNumber: `REF-${Date.now()}`,
      verificationStatus: "verified",
      recordedBy: superAdminUser._id,
      isDeleted: false,
    });
    createdPaymentIds.push(payment1MonthAgo._id);
  });

  afterAll(async () => {
    for (const invId of createdInvoiceIds) {
      await Invoice.deleteOne({ _id: invId });
    }
    for (const payId of createdPaymentIds) {
      await PaymentRecord.deleteOne({ _id: payId });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    for (const orgId of createdOrgIds) {
      await Organization.deleteOne({ _id: orgId });
    }
    await app.close();
  });

  it("Step 1: GET /finance returns exactly 6 months of historical trajectory", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.monthlyGrowth)).toBe(true);
    expect(body.data.monthlyGrowth.length).toBe(6);
  });

  it("Step 2: Seeded invoice paid 2 months ago ($500) reflects exactly $500 MRR and $6,000 ARR", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const body = JSON.parse(response.body);
    const monthlyGrowth = body.data.monthlyGrowth;

    // Month -2 is at index 3 (i = 2, where i = 5 is index 0, i = 0 is index 5)
    const monthMinus2 = monthlyGrowth[3];
    expect(monthMinus2.month).toBe(twoMonthsAgoLabel);
    expect(monthMinus2.mrr).toBe(500);
    expect(monthMinus2.arr).toBe(6000);
  });

  it("Step 3: Month -3 with zero paid invoices/payments transparently reports $0 (not a synthetic multiplier)", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const body = JSON.parse(response.body);
    const monthlyGrowth = body.data.monthlyGrowth;

    // Month -3 is at index 2 (i = 3)
    const monthMinus3 = monthlyGrowth[2];
    expect(monthMinus3.month).toBe(threeMonthsAgoLabel);
    // Absolute truth: $0 revenue, not an artificial scaleFactor (e.g. 50% of totalMrr)
    expect(monthMinus3.mrr).toBe(0);
    expect(monthMinus3.arr).toBe(0);
  });

  it("Step 4: Unlinked payment receipt paid 1 month ago ($350) reflects in month -1 trajectory", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const body = JSON.parse(response.body);
    const monthlyGrowth = body.data.monthlyGrowth;

    // Month -1 is at index 4 (i = 1)
    const monthMinus1 = monthlyGrowth[4];
    expect(monthMinus1.month).toBe(oneMonthAgoLabel);
    expect(monthMinus1.mrr).toBe(350);
    expect(monthMinus1.arr).toBe(4200);
  });

  it("Step 5: All months contain non-NaN numbers and subscriptions count", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    const body = JSON.parse(response.body);
    const monthlyGrowth = body.data.monthlyGrowth;

    for (const point of monthlyGrowth) {
      expect(typeof point.month).toBe("string");
      expect(typeof point.mrr).toBe("number");
      expect(typeof point.arr).toBe("number");
      expect(typeof point.subscriptions).toBe("number");
      expect(Number.isNaN(point.mrr)).toBe(false);
      expect(Number.isNaN(point.arr)).toBe(false);
      expect(Number.isNaN(point.subscriptions)).toBe(false);
      expect(point.mrr).toBeGreaterThanOrEqual(0);
      expect(point.arr).toBe(point.mrr * 12);
    }
  });
});
