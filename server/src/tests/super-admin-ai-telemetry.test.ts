import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import AIUsageRecord from "../modules/super-admin/models/ai-usage-record.model.js";
import {
  calculateAICostUsd,
  estimateTokensFromText,
  AIProviderService,
} from "../modules/integrations/services/ai-provider.service.js";

describe("Super Admin AI Telemetry Suite: SA-OBS-002 Token Consumption & Cost Persistence", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let nonAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let nonAdminToken: string;

  const testPrefix = `sa-ai-${Date.now()}`;
  const createdRecordIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: `AI Telemetry Org ${testPrefix}`,
      slug: `ai-telemetry-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ai-admin-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "AI",
        lastName: "Admin",
        fullName: "AI Admin",
      },
      employment: {
        department: "Engineering",
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

    // 3. Create Non-Admin User (Employee)
    nonAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `ai-staff-${testPrefix}@talnova.test`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "AI",
        lastName: "Staff",
        fullName: "AI Staff",
      },
      employment: {
        department: "HR",
        jobTitle: "Specialist",
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
    if (createdRecordIds.length > 0) {
      await AIUsageRecord.deleteMany({ _id: { $in: createdRecordIds } });
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

  describe("1. Pricing and Token Estimation Unit Logic", () => {
    it("computes accurate cost for Gemini 1.5 Flash", () => {
      // 1,000,000 prompt tokens = $0.075, 1,000,000 completion tokens = $0.30
      const cost = calculateAICostUsd("gemini-1.5-flash", 1000, 2000);
      // prompt: 1000 * 0.000000075 = 0.000075
      // completion: 2000 * 0.00000030 = 0.000600
      // total = 0.000675 -> rounded to 5 decimals: 0.00068
      expect(cost).toBeCloseTo(0.00068, 4);
    });

    it("computes accurate cost for GPT-4o", () => {
      // prompt: $2.50 / 1M, completion: $10.00 / 1M
      const cost = calculateAICostUsd("gpt-4o", 10000, 5000);
      // prompt: 10000 * 0.0000025 = 0.025
      // completion: 5000 * 0.000010 = 0.05
      // total = 0.075
      expect(cost).toBe(0.075);
    });

    it("handles unknown model with fallback pricing gracefully", () => {
      const cost = calculateAICostUsd("unknown-experimental-model", 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });

    it("estimates tokens accurately from raw text using 4-character heuristic", () => {
      const text = "Hello world! This is a test sentence for token estimation.";
      const estimated = estimateTokensFromText(text);
      expect(estimated).toBe(Math.ceil(text.length / 4));
      expect(estimateTokensFromText("")).toBe(0);
    });
  });

  describe("2. AIUsageRecord Mongoose Model Validation", () => {
    it("automatically calculates totalTokens and persists valid record", async () => {
      const record = await AIUsageRecord.create({
        organizationId: testOrg._id,
        userId: superAdminUser._id,
        feature: "ai_course_builder",
        provider: "google",
        model: "gemini-1.5-flash",
        promptTokens: 450,
        completionTokens: 250,
        costEstimateUSD: 0.00025,
        durationMs: 1420,
        status: "success",
      });
      createdRecordIds.push(record._id);

      expect(record.totalTokens).toBe(700);
      expect(record.costEstimateUSD).toBe(0.00025);
      expect(record.status).toBe("success");
      expect(record.createdAt).toBeInstanceOf(Date);
    });

    it("AIProviderService.recordUsage helper creates records without throwing", async () => {
      const record = await AIProviderService.recordUsage({
        organizationId: testOrg._id.toString(),
        userId: superAdminUser._id.toString(),
        feature: "ai_assistant",
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 1200,
        completionTokens: 300,
        durationMs: 850,
        status: "success",
      });

      expect(record).not.toBeNull();
      if (record) {
        createdRecordIds.push(record._id);
        expect(record.totalTokens).toBe(1500);
        expect(record.feature).toBe("ai_assistant");
        expect(record.costEstimateUSD).toBeGreaterThan(0);
      }
    });
  });

  describe("3. GET /api/v1/super-admin/observability/ai Aggregations", () => {
    it("returns real aggregated data matching seeded usage records", async () => {
      // Create additional seeded records
      const r1 = await AIUsageRecord.create({
        organizationId: testOrg._id,
        userId: superAdminUser._id,
        feature: "kb_rag",
        provider: "anthropic",
        model: "claude-3-5-sonnet-20241022",
        promptTokens: 5000,
        completionTokens: 1000,
        costEstimateUSD: 0.03,
        durationMs: 2100,
        status: "success",
      });
      const r2 = await AIUsageRecord.create({
        organizationId: testOrg._id,
        userId: superAdminUser._id,
        feature: "document_summary",
        provider: "google",
        model: "gemini-1.5-pro",
        promptTokens: 8000,
        completionTokens: 2000,
        costEstimateUSD: 0.04,
        durationMs: 3200,
        status: "success",
      });
      createdRecordIds.push(r1._id, r2._id);

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/observability/ai",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();

      const { data } = json;
      expect(data.tokensConsumed).toBeGreaterThanOrEqual(18200); // 700 + 1500 + 6000 + 10000
      expect(data.costEstimateUSD).toBeGreaterThanOrEqual(0.07);
      expect(data.totalRequests).toBeGreaterThanOrEqual(4);
      expect(data.monthlyBudget).toBe(2500000);
      expect(data.utilizationPct).toBeDefined();

      // Feature breakdown check
      expect(Array.isArray(data.featureBreakdown)).toBe(true);
      const courseBuilder = data.featureBreakdown.find((f: any) => f.feature === "AI Course Builder");
      expect(courseBuilder).toBeDefined();
      expect(courseBuilder.tokens).toBeGreaterThanOrEqual(700);

      const assistant = data.featureBreakdown.find((f: any) => f.feature === "Onboarding Assistant");
      expect(assistant).toBeDefined();
      expect(assistant.tokens).toBeGreaterThanOrEqual(1500);

      const rag = data.featureBreakdown.find((f: any) => f.feature === "Knowledge Base RAG");
      expect(rag).toBeDefined();
      expect(rag.tokens).toBeGreaterThanOrEqual(6000);

      const docSummary = data.featureBreakdown.find((f: any) => f.feature === "Document Summarizer");
      expect(docSummary).toBeDefined();
      expect(docSummary.tokens).toBeGreaterThanOrEqual(10000);
    });
  });

  describe("4. GET /api/v1/super-admin/ai/usage Granular Log Endpoint", () => {
    it("returns paginated records with populated organization and user fields", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/ai/usage?limit=10&page=1",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      expect(json.data.items).toBeDefined();
      expect(Array.isArray(json.data.items)).toBe(true);
      expect(json.data.pagination).toBeDefined();
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.limit).toBe(10);
      expect(json.data.pagination.total).toBeGreaterThanOrEqual(4);

      // Verify population on first item that has organizationId
      const orgItem = json.data.items.find((item: any) => item.organizationId && typeof item.organizationId === "object");
      if (orgItem) {
        expect(orgItem.organizationId.name).toBeDefined();
      }
    });

    it("filters records by feature", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/ai/usage?feature=ai_course_builder",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const json = JSON.parse(res.payload);
      expect(json.success).toBe(true);
      for (const item of json.data.items) {
        expect(item.feature).toBe("ai_course_builder");
      }
    });
  });

  describe("5. RBAC and Security Enforcement", () => {
    it("rejects non-super-admin from /observability/ai with 403", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/observability/ai",
        headers: {
          authorization: `Bearer ${nonAdminToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it("rejects non-super-admin from /ai/usage with 403", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/ai/usage",
        headers: {
          authorization: `Bearer ${nonAdminToken}`,
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it("rejects unauthenticated request with 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/super-admin/observability/ai",
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
