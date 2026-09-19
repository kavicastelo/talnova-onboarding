import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import Invoice from "../modules/super-admin/models/invoice.model.js";
import PaymentRecord from "../modules/super-admin/models/payment-record.model.js";
import ExpenseRecord from "../modules/super-admin/models/expense-record.model.js";
import Session from "../modules/auth/models/session.model.js";
import AIUsageRecord from "../modules/super-admin/models/ai-usage-record.model.js";
import TelemetryBuffer from "../infrastructure/telemetry/telemetry-buffer.js";

describe("Super Admin Reports Suite: SA-REP-001 Canonical Reports Backend Streaming Generation Engine", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `sa-rep-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdInvoiceIds: mongoose.Types.ObjectId[] = [];
  const createdPaymentIds: mongoose.Types.ObjectId[] = [];
  const createdExpenseIds: mongoose.Types.ObjectId[] = [];
  const createdSessionIds: mongoose.Types.ObjectId[] = [];
  const createdAIUsageIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Reports Test Org ${testPrefix}`,
      slug: `rep-org-${testPrefix}`,
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
        email: `rep-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Report",
        lastName: "Admin",
        fullName: "Report Admin",
      },
      employment: {
        department: "SecOps",
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

    // 3. Create Employee User
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `rep-employee-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Rep",
        lastName: "Staff",
        fullName: "Rep Staff",
      },
      employment: {
        department: "HR",
        jobTitle: "Coordinator",
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

    // 4. Seed an Invoice
    const invoice = await Invoice.create({
      invoiceNo: `INV-${testPrefix}`,
      organizationId: testOrg._id,
      customerName: testOrg.name,
      currency: "USD",
      status: "sent",
      lineItems: [
        {
          description: "Enterprise Subscription",
          quantity: 1,
          unitPrice: 12000,
          amount: 12000,
        },
      ],
      subtotal: 12000,
      totalAmount: 12000,
      amountPaid: 0,
      balanceDue: 12000,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      createdBy: superAdminUser._id,
    });
    createdInvoiceIds.push(invoice._id);

    // 5. Seed a Payment Record
    const payment = await PaymentRecord.create({
      paymentNo: `PAY-${testPrefix}`,
      invoiceId: invoice._id,
      invoiceNo: invoice.invoiceNo,
      organizationId: testOrg._id,
      organizationName: testOrg.name,
      amount: 4000,
      currency: "USD",
      paymentDate: new Date(),
      paymentMethod: "bank_transfer",
      referenceNumber: `WIRE-REF-${testPrefix}`,
      verificationStatus: "verified",
      recordedBy: superAdminUser._id,
      recordedByEmail: superAdminUser.auth.email,
    });
    createdPaymentIds.push(payment._id);

    // 6. Seed an Expense Record
    const expense = await ExpenseRecord.create({
      expenseNo: `EXP-${testPrefix}`,
      category: "ai_compute",
      vendor: "Anthropic",
      amount: 1500,
      currency: "USD",
      expenseDate: new Date(),
      description: "Claude 3.5 API inferences",
      isRecurring: false,
      createdBy: superAdminUser._id,
    });
    createdExpenseIds.push(expense._id);

    // 7. Seed a Session
    const session = await Session.create({
      userId: superAdminUser._id,
      organizationId: testOrg._id,
      tokenVersion: 1,
      deviceInfo: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      ipAddress: "192.168.1.100",
      isValid: true,
      lastActivityAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 86400000),
    });
    createdSessionIds.push(session._id);

    // 8. Seed AI Usage Record
    const aiUsage = await AIUsageRecord.create({
      organizationId: testOrg._id,
      userId: superAdminUser._id,
      feature: "ai_course_builder",
      provider: "anthropic",
      model: "claude-3-5-sonnet",
      promptTokens: 800,
      completionTokens: 400,
      totalTokens: 1200,
      costUSD: 0.0084,
      latencyMs: 1420,
      statusCode: 200,
    });
    createdAIUsageIds.push(aiUsage._id);

    // 9. Record a request in TelemetryBuffer
    TelemetryBuffer.record({
      method: "GET",
      route: "/api/v1/super-admin/reports/test",
      durationMs: 45,
      statusCode: 200,
      timestamp: new Date(),
    });
  });

  afterAll(async () => {
    if (createdInvoiceIds.length > 0) {
      await Invoice.deleteMany({ _id: { $in: createdInvoiceIds } });
    }
    if (createdPaymentIds.length > 0) {
      await PaymentRecord.deleteMany({ _id: { $in: createdPaymentIds } });
    }
    if (createdExpenseIds.length > 0) {
      await ExpenseRecord.deleteMany({ _id: { $in: createdExpenseIds } });
    }
    if (createdSessionIds.length > 0) {
      await Session.deleteMany({ _id: { $in: createdSessionIds } });
    }
    if (createdAIUsageIds.length > 0) {
      await AIUsageRecord.deleteMany({ _id: { $in: createdAIUsageIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (superAdminUser) {
      await User.deleteOne({ _id: superAdminUser._id });
    }
    if (nonAdminUser) {
      await User.deleteOne({ _id: nonAdminUser._id });
    }
  });

  describe("Security & Access Control (RBAC)", () => {
    it("should reject unauthenticated export requests with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-org-growth/export",
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject non-super-admin users with 403", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-org-growth/export",
        headers: {
          authorization: `Bearer ${nonAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("should return 404 when exporting an unknown report ID", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-non-existent-xyz/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.body);
      expect(body.message).toContain("not found in canonical reports catalog");
    });
  });

  describe("Canonical CSV Export & Real Database Content", () => {
    it("should export rep-org-growth as CSV containing real seeded organization", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-org-growth/export?format=csv",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.headers["content-disposition"]).toContain('attachment; filename="rep-org-growth-');
      expect(res.body).toContain('"Organization ID","Name","Slug","Plan Tier","Status"');
      expect(res.body).toContain(`Reports Test Org ${testPrefix}`);
      expect(res.body).toContain(`rep-org-${testPrefix}`);
      expect(res.body).toContain("Enterprise");
    });

    it("should create an immutable DATA_EXPORTED audit log entry upon export", async () => {
      const auditEntry = await AuditLog.findOne({
        eventType: "DATA_EXPORTED",
        actorUserId: superAdminUser._id,
        "metadata.reportId": "rep-org-growth",
      }).sort({ createdAt: -1 });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.action).toBe("export");
      expect(auditEntry?.resourceType).toBe("Report");
      expect(auditEntry?.metadata?.format).toBe("csv");
    });

    it("should export rep-arr-ledger with real seeded invoice", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-arr-ledger/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.body).toContain('"Metric","Value USD","Notes"');
      expect(res.body).toContain('"Total Invoiced Gross"');
      expect(res.body).toContain('"Total Cash Collected"');
      expect(res.body).toContain('"Total Operating Expenses"');
    });

    it("should export rep-payment-reconciliation with real seeded payment record", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-payment-reconciliation/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"Payment No","Invoice No","Organization","Amount"');
      expect(res.body).toContain(`PAY-${testPrefix}`.toUpperCase());
      expect(res.body).toContain("4000");
      expect(res.body).toContain(`WIRE-REF-${testPrefix}`);
      expect(res.body).toContain("verified");
    });

    it("should export rep-operating-expenses with real seeded expense record", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-operating-expenses/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"Expense No","Category","Vendor","Amount USD"');
      expect(res.body).toContain(`EXP-${testPrefix}`.toUpperCase());
      expect(res.body).toContain("ai_compute");
      expect(res.body).toContain("Anthropic");
      expect(res.body).toContain("1500");
    });

    it("should export rep-ai-tokens with real seeded token consumption record", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-ai-tokens/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.body).toContain('"Record ID","Feature","Provider","Model"');
      expect(res.body).toContain("ai_course_builder");
      expect(res.body).toContain("claude-3-5-sonnet");
      expect(res.body).toContain("1200");
    });

    it("should export rep-api-latency with real TelemetryBuffer metrics", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-api-latency/export",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const payload = JSON.parse(res.body);
      expect(payload.report).toBe("API Latency & Route Reliability");
      expect(payload.endpoints.some((e: any) => e.route.includes("/api/v1/super-admin/reports/test"))).toBe(true);
    });
  });

  describe("Canonical JSON Export Streaming", () => {
    it("should export rep-session-security formatted as structured JSON", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-session-security/export?format=json",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      expect(res.headers["content-disposition"]).toContain(".json");

      const payload = JSON.parse(res.body);
      expect(payload.report).toBe("Active User Sessions & Security");
      expect(payload.totalSessions).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(payload.sessions)).toBe(true);

      const targetSession = payload.sessions.find((s: any) => s.ipAddress === "192.168.1.100");
      expect(targetSession).toBeDefined();
      expect(targetSession.deviceInfo).toContain("Windows NT");
      expect(targetSession.isActive).toBe(true);
    });

    it("should export rep-user-licenses formatted as structured JSON", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/reports/rep-user-licenses/export?format=json",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const payload = JSON.parse(res.body);
      expect(payload.report).toBe("Cross-Tenant User License & Seat Consumption");
      expect(Array.isArray(payload.tenants)).toBe(true);
    });
  });
});
