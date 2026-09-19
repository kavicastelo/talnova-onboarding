import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import ExpenseRecord from "../modules/super-admin/models/expense-record.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Super Admin Expenses Suite: SA-FIN-003 ExpenseRecord Schema & Deterministic Telemetry P&L", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;
  const createdExpenseIds: mongoose.Types.ObjectId[] = [];

  const testPrefix = `sa-exp-${Date.now()}`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `Expense Corp ${testPrefix}`,
      slug: `expense-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ops-finance-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Finance",
        lastName: "Controller",
        fullName: "Finance Controller",
      },
      employment: {
        department: "Operations",
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
        email: `staff-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Staff",
        lastName: "Member",
        fullName: "Staff Member",
      },
      employment: {
        department: "Support",
        jobTitle: "Agent",
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
    if (createdExpenseIds.length > 0) {
      await ExpenseRecord.deleteMany({ _id: { $in: createdExpenseIds } });
    }
    await AuditLog.deleteMany({
      actorUserId: superAdminUser?._id,
      eventType: "EXPENSE_RECORDED",
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

  let primaryExpense: any;

  it("1. Record verified expense ($250 for Cloudflare): creates authoritative ExpenseRecord", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        category: "infrastructure",
        vendor: "Cloudflare",
        amount: 250.0,
        currency: "USD",
        description: "Cloud edge CDN, DDoS mitigation and DNS routing",
        organizationId: testOrg._id.toString(),
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.expenseNo).toMatch(/^EXP-\d+-\d+$/);
    expect(body.data.amount).toBe(250);
    expect(body.data.category).toBe("infrastructure");
    expect(body.data.vendor).toBe("Cloudflare");
    primaryExpense = body.data;
    createdExpenseIds.push(new mongoose.Types.ObjectId(primaryExpense.id));

    // Directly verify in MongoDB
    const dbRecord = await ExpenseRecord.findById(primaryExpense.id);
    expect(dbRecord).toBeDefined();
    expect(dbRecord!.expenseNo).toBe(primaryExpense.expenseNo);
    expect(dbRecord!.amount).toBe(250);
    expect(dbRecord!.category).toBe("infrastructure");
    expect(dbRecord!.vendor).toBe("Cloudflare");
    expect(dbRecord!.createdBy.toString()).toBe(superAdminUser._id.toString());
  });

  it("2. Query GET /telemetry: verifies operatingExpenses reflects $250 and netOperatingResult accounts for it", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.stats).toBeDefined();

    const stats = body.data.stats;
    expect(stats.operatingExpenses).toBeDefined();
    expect(stats.operatingExpenses.value).toBeGreaterThanOrEqual(250);

    expect(stats.netOperatingResult).toBeDefined();
    const expectedNet = Math.round((stats.cashCollected.value - stats.operatingExpenses.value + Number.EPSILON) * 100) / 100;
    expect(stats.netOperatingResult.value).toBe(expectedNet);
    expect(stats.operatingExpenses.delta).toBeDefined();
  });

  it("3. Reject invalid expense category: returns HTTP 400 with descriptive error", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        category: "invalid_crypto_speculation",
        vendor: "Unknown Vendor",
        amount: 500,
        description: "Unsupported category",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/Invalid expense category/i);
  });

  it("4. Reject non-positive or negative expense amounts: returns HTTP 400", async () => {
    // Negative amount
    const resNeg = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        category: "infrastructure",
        vendor: "Cloudflare",
        amount: -100,
        description: "Negative refund attempt",
      },
    });
    expect(resNeg.statusCode).toBe(400);

    // Zero amount
    const resZero = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        category: "infrastructure",
        vendor: "Cloudflare",
        amount: 0,
        description: "Zero amount",
      },
    });
    expect(resZero.statusCode).toBe(400);
  });

  it("5. Net Operating Loss test: large expenses produce a deterministic negative Net Operating Result", async () => {
    // Inject a $1,000,000 operational expenditure
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        category: "ai_compute",
        vendor: "Google Cloud Gemini",
        amount: 1000000.0,
        description: "Mega foundation model pre-training compute reservation",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    createdExpenseIds.push(new mongoose.Types.ObjectId(body.data.id));

    // Telemetry check
    const telemRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/telemetry",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(telemRes.statusCode).toBe(200);
    const telemBody = JSON.parse(telemRes.payload);
    const stats = telemBody.data.stats;
    expect(stats.operatingExpenses.value).toBeGreaterThanOrEqual(1000250);
    expect(stats.netOperatingResult.value).toBeLessThan(0); // True operational loss!
    expect(stats.netOperatingResult.value).toBe(
      Math.round((stats.cashCollected.value - stats.operatingExpenses.value + Number.EPSILON) * 100) / 100
    );
  });

  it("6. Verify GET /finance/expenses returns populated list and correct totalExpenses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.expenses).toBeDefined();
    expect(Array.isArray(body.data.expenses)).toBe(true);
    expect(body.data.totalExpenses).toBeGreaterThanOrEqual(1000250);

    const found = body.data.expenses.find((e: any) => e.expenseNo === primaryExpense.expenseNo);
    expect(found).toBeDefined();
    expect(found.vendor).toBe("Cloudflare");
    expect(found.category).toBe("infrastructure");
    expect(found.amount).toBe(250);
  });

  it("7. Verify AuditLog entry for EXPENSE_RECORDED with accurate metadata", async () => {
    const auditLogs = await AuditLog.find({
      actorUserId: superAdminUser._id,
      eventType: "EXPENSE_RECORDED",
    }).sort({ createdAt: -1 });

    expect(auditLogs.length).toBeGreaterThanOrEqual(2);
    const foundLog = auditLogs.find((l: any) => l.metadata?.expenseNo === primaryExpense.expenseNo);
    expect(foundLog).toBeDefined();
    expect(foundLog!.resourceType).toBe("ExpenseRecord");
    expect(foundLog!.metadata?.amount).toBe(250);
    expect(foundLog!.metadata?.vendor).toBe("Cloudflare");
    expect(foundLog!.metadata?.category).toBe("infrastructure");
  });

  it("8. Enforce RBAC: Non-super-admin user receives HTTP 403 Forbidden", async () => {
    // Attempt to record expense
    const postRes = await app.inject({
      method: "POST",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
      payload: {
        category: "software_licenses",
        vendor: "GitHub Enterprise",
        amount: 210,
        description: "Seat licenses",
      },
    });
    expect(postRes.statusCode).toBe(403);

    // Attempt to view expenses
    const getRes = await app.inject({
      method: "GET",
      url: "/api/v1/super-admin/finance/expenses",
      headers: {
        Authorization: `Bearer ${nonAdminToken}`,
      },
    });
    expect(getRes.statusCode).toBe(403);
  });
});
