import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Company from "../modules/sales/models/company.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("CRM-001: Sales Pipeline Configuration & Stage Definition API", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;

  const testPrefix = `pipe-test-${Date.now()}`;
  const createdPipelineIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Pipe Test Org ${testPrefix}`,
      slug: `pipe-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `pipe-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Pipeline",
        lastName: "Admin",
        fullName: "Pipeline Admin",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "super_admin",
        customRoles: [],
      },
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `pipe-employee-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Sales",
        fullName: "Regular Sales",
      },
      employment: {
        status: "active",
      },
      permissions: {
        role: "employee",
        customRoles: [],
      },
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    regularToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      email: regularUser.auth.email,
      role: regularUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdPipelineIds.length > 0) {
      await Pipeline.deleteMany({ _id: { $in: createdPipelineIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    await app.close();
    await disconnectDatabase(app.log);
  });

  describe("1. Route Protection & RBAC Guard", () => {
    it("should reject requests without authorization token with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/pipelines",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should reject non-super_admin roles with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/pipelines",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should allow super_admin access to list pipelines", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/pipelines",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  describe("2. Default Pipeline Out-of-the-Box Auto-Seeding", () => {
    it("should auto-seed default pipeline with the exact 7 required stages and probabilities", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/pipelines/default",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const defaultPipe = body.data;
      expect(defaultPipe.isDefault).toBe(true);
      expect(defaultPipe.stages.length).toBe(7);

      // Verify the 7 prompt-mandated stages
      const expectedStages = [
        { key: "qualification", prob: 0.1, order: 0 },
        { key: "discovery_completed", prob: 0.25, order: 1 },
        { key: "demo_completed", prob: 0.5, order: 2 },
        { key: "proposal_sent", prob: 0.7, order: 3 },
        { key: "negotiation", prob: 0.85, order: 4 },
        { key: "closed_won", prob: 1.0, order: 5 },
        { key: "closed_lost", prob: 0.0, order: 6 },
      ];

      expectedStages.forEach((exp) => {
        const found = defaultPipe.stages.find((s: any) => s.key === exp.key);
        expect(found).toBeDefined();
        expect(found.probability).toBe(exp.prob);
        expect(found.order).toBe(exp.order);
      });
    });
  });

  describe("3. Custom Pipeline Creation & Probability Validation", () => {
    it("should create a custom sales pipeline and record an AuditLog", async () => {
      const payload = {
        name: `Mid-Market Expansion ${testPrefix}`,
        isDefault: false,
        stages: [
          { key: "outreach", name: "Outreach", probability: 0.15, order: 0 },
          { key: "technical_eval", name: "Technical Evaluation", probability: 0.45, order: 1 },
          { key: "commercial_close", name: "Commercial Close", probability: 0.9, order: 2 },
          { key: "closed_won", name: "Closed Won", probability: 1.0, order: 3 },
          { key: "closed_lost", name: "Closed Lost", probability: 0.0, order: 4 },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/pipelines",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe(payload.name);
      expect(body.data.stages.length).toBe(5);

      createdPipelineIds.push(new mongoose.Types.ObjectId(body.data._id));

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(body.data._id),
        eventType: "PIPELINE_CREATED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe("create");
    });

    it("should reject duplicate stage keys within the same pipeline", async () => {
      const payload = {
        name: `Duplicate Key Test ${testPrefix}`,
        stages: [
          { key: "discovery", name: "Discovery 1", probability: 0.2, order: 0 },
          { key: "discovery", name: "Discovery 2", probability: 0.3, order: 1 },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/pipelines",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("DUPLICATE_STAGE_KEY");
    });

    it("should reject stage probability outside the range [0.0, 1.0]", async () => {
      const payload = {
        name: `Invalid Probability Test ${testPrefix}`,
        stages: [
          { key: "invalid_prob", name: "Invalid", probability: 1.5, order: 0 },
        ],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/pipelines",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("4. Stage Customization & Dynamic Deal Probability Synchronization", () => {
    let customPipeline: any;
    let testCompany: any;
    let testDeal: any;

    beforeAll(async () => {
      // Create pipeline
      customPipeline = await Pipeline.create({
        name: `Sync Test Pipeline ${testPrefix}`,
        isDefault: false,
        stages: [
          { key: "qualification", name: "Qualification", probability: 0.1, order: 0 },
          { key: "solution_demo", name: "Solution Demo", probability: 0.5, order: 1 },
          { key: "closed_won", name: "Won", probability: 1.0, order: 2 },
        ],
      });
      createdPipelineIds.push(customPipeline._id);

      // Create company
      testCompany = await Company.create({
        name: `Pipeline Deal Co ${testPrefix}`,
        domain: `dealco-${testPrefix}.test`,
        status: "prospect",
        tags: ["crm-test"],
      });
      createdCompanyIds.push(testCompany._id);

      // Create a deal in 'solution_demo' stage with initial probability 0.5
      testDeal = await Deal.create({
        name: `Enterprise Deal ${testPrefix}`,
        companyId: testCompany._id,
        pipelineId: customPipeline._id,
        stage: "solution_demo",
        value: 100000,
        currency: "USD",
        annualRecurringRevenue: 100000,
        oneTimeImplementationFee: 15000,
        probability: 0.5,
      });
      createdDealIds.push(testDeal._id);
    });

    it("should customize stage probability via PATCH and dynamically update active deal probabilities", async () => {
      // Update 'solution_demo' probability from 0.5 to 0.65
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/pipelines/${customPipeline._id}/stages/solution_demo`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          probability: 0.65,
          slaDays: 10,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const updatedStage = body.data.stages.find((s: any) => s.key === "solution_demo");
      expect(updatedStage.probability).toBe(0.65);
      expect(updatedStage.slaDays).toBe(10);

      // Verify dynamically updated deal probability in database
      const dealInDb = await Deal.findById(testDeal._id);
      expect(dealInDb?.probability).toBe(0.65);
    });

    it("should bulk update stages via PUT and recompute deal probabilities", async () => {
      const updatedStages = [
        { key: "qualification", name: "Qualification", probability: 0.15, order: 0 },
        { key: "solution_demo", name: "Solution Demo", probability: 0.7, order: 1 },
        { key: "closed_won", name: "Won", probability: 1.0, order: 2 },
      ];

      const response = await app.inject({
        method: "PUT",
        url: `/api/v1/sales/pipelines/${customPipeline._id}/stages`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          stages: updatedStages,
        },
      });

      expect(response.statusCode).toBe(200);

      // Verify deal probability is synced to 0.70
      const dealInDb = await Deal.findById(testDeal._id);
      expect(dealInDb?.probability).toBe(0.7);
    });
  });

  describe("5. Stage Addition & Deletion Safety Guard", () => {
    let customPipeline: any;
    let testCompany: any;
    let activeDeal: any;

    beforeAll(async () => {
      customPipeline = await Pipeline.create({
        name: `Delete Stage Test ${testPrefix}`,
        isDefault: false,
        stages: [
          { key: "stage_a", name: "Stage A", probability: 0.2, order: 0 },
          { key: "stage_b", name: "Stage B", probability: 0.5, order: 1 },
          { key: "stage_c", name: "Stage C", probability: 0.8, order: 2 },
        ],
      });
      createdPipelineIds.push(customPipeline._id);

      testCompany = await Company.create({
        name: `Stage Test Co ${testPrefix}`,
        domain: `stageco-${testPrefix}.test`,
      });
      createdCompanyIds.push(testCompany._id);

      // Deal occupying stage_b
      activeDeal = await Deal.create({
        name: `Stage Deal ${testPrefix}`,
        companyId: testCompany._id,
        pipelineId: customPipeline._id,
        stage: "stage_b",
        value: 50000,
        currency: "USD",
        annualRecurringRevenue: 50000,
        oneTimeImplementationFee: 5000,
        probability: 0.5,
      });
      createdDealIds.push(activeDeal._id);
    });

    it("should append a new stage via POST /:id/stages", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/pipelines/${customPipeline._id}/stages`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          key: "stage_new",
          name: "Security Audit Stage",
          probability: 0.6,
          order: 3,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.stages.some((s: any) => s.key === "stage_new")).toBe(true);
    });

    it("should reject deleting a stage occupied by active deals with 400 Bad Request", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/pipelines/${customPipeline._id}/stages/stage_b`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("CANNOT_DELETE_STAGE_WITH_ACTIVE_DEALS");
    });

    it("should permit deleting a stage once deals are transitioned or empty", async () => {
      // stage_c has no deals
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/pipelines/${customPipeline._id}/stages/stage_c`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.stages.some((s: any) => s.key === "stage_c")).toBe(false);
    });
  });

  describe("6. Pipeline Deletion Guards", () => {
    it("should prevent deleting default pipeline with 400 Bad Request", async () => {
      const defaultPipe = await Pipeline.findOne({ isDefault: true });
      expect(defaultPipe).toBeDefined();

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/pipelines/${defaultPipe!._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("CANNOT_DELETE_DEFAULT_PIPELINE");
    });

    it("should delete a non-default pipeline that has no deals and log AuditLog", async () => {
      const disposablePipeline = await Pipeline.create({
        name: `Disposable Pipeline ${testPrefix}`,
        isDefault: false,
        stages: [
          { key: "temp_stage", name: "Temp Stage", probability: 0.5, order: 0 },
        ],
      });

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/pipelines/${disposablePipeline._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      const deletedCheck = await Pipeline.findById(disposablePipeline._id);
      expect(deletedCheck).toBeNull();

      const audit = await AuditLog.findOne({
        resourceId: disposablePipeline._id,
        eventType: "PIPELINE_DELETED",
      });
      expect(audit).toBeDefined();
      expect(audit!.action).toBe("delete");
    });
  });
});
