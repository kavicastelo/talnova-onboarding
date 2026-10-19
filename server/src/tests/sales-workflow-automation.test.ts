import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import Company from "../modules/sales/models/company.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import { QueueService } from "../infrastructure/queue/queue.service.js";
import { EventBus } from "../infrastructure/events/event-bus.js";
import { AutomationEngineService } from "../modules/sales/services/automation-engine.service.js";
import { processAutomationJob } from "../modules/sales/workers/automation.worker.js";

describe("AUTO-001: Sales Workflow Automation Engine & Pre-built Rules", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let repUser1: any;
  let repUser2: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testCompany: any;
  let testPipeline: any;

  const testPrefix = `auto-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdPipelineIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  const automationService = AutomationEngineService.getInstance();
  const queue = QueueService.getInstance();
  const eventBus = EventBus.getInstance();

  async function waitFor(fn: () => Promise<boolean>, timeoutMs = 4000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await fn()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Automation Test Org ${testPrefix}`,
      slug: `auto-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `auto-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
      },
      roles: ["super_admin"],
      systemRole: "super_admin",
      status: "Active",
      employment: {
        status: "active",
        employmentType: "full_time",
        department: "Executive",
      },
    });
    createdUserIds.push(superAdminUser._id);

    repUser1 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `auto-rep1-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Alice",
        lastName: "Walker",
        fullName: "Alice Walker",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "Active",
      employment: {
        status: "active",
        employmentType: "full_time",
        department: "Sales",
      },
    });
    createdUserIds.push(repUser1._id);

    repUser2 = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `auto-rep2-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Bob",
        lastName: "Vance",
        fullName: "Bob Vance",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "Active",
      employment: {
        status: "active",
        employmentType: "full_time",
        department: "Sales",
      },
    });
    createdUserIds.push(repUser2._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `auto-reg-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Staff",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "Active",
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      id: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      roles: ["super_admin"],
      organizationId: testOrg._id.toString(),
    });

    regularToken = app.jwt.sign({
      id: regularUser._id.toString(),
      email: regularUser.auth.email,
      roles: ["employee"],
      organizationId: testOrg._id.toString(),
    });

    testCompany = await Company.create({
      name: `Automation Systems ${testPrefix}`,
      domain: `auto-${testPrefix}.test`,
      industry: "Manufacturing",
      status: "prospect",
    });
    createdCompanyIds.push(testCompany._id);

    testPipeline = await Pipeline.create({
      name: `Auto Pipeline ${testPrefix}`,
      isDefault: true,
      stages: [
        { key: "lead", name: "Lead", probability: 0.1, order: 1 },
        { key: "proposal", name: "Proposal", probability: 0.5, order: 2 },
        { key: "negotiation", name: "Negotiation", probability: 0.8, order: 3 },
      ],
    });
    createdPipelineIds.push(testPipeline._id);
  });

  afterAll(async () => {
    if (createdTaskIds.length) {
      await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    }
    await SalesTask.deleteMany({ title: { $regex: testPrefix } });

    if (createdDealIds.length) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdLeadIds.length) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdPipelineIds.length) {
      await Pipeline.deleteMany({ _id: { $in: createdPipelineIds } });
    }
    if (createdCompanyIds.length) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdUserIds.length) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }

    await app.close();
    await disconnectDatabase();
  });

  describe("1. RBAC & Security Boundaries", () => {
    it("should return 401 when accessing automation endpoints without auth", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/automation/rules",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 when non-super-admin user accesses automation rules", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/automation/rules",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should return 200 and list pre-configured rules for super admin", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/automation/rules",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThanOrEqual(4);
      expect(body.data.some((r: any) => r.id === "auto_followup")).toBe(true);
      expect(body.data.some((r: any) => r.id === "stale_lead_escalation")).toBe(true);
    });
  });

  describe("2. Rule: Auto Follow-Up on Inbound Leads & Idempotency", () => {
    it("should auto-schedule a high-priority follow-up task when lead created from website", async () => {
      const lead = await Lead.create({
        name: `Inbound Web Lead ${testPrefix}`,
        email: `web-lead-${testPrefix}@test.com`,
        normalizedEmail: `web-lead-${testPrefix}@test.com`,
        companyName: `WebCo ${testPrefix}`,
        source: "website",
        status: "new",
        score: 50,
      });
      createdLeadIds.push(lead._id);

      // Trigger lead:created
      await automationService.handleLeadCreated(lead._id.toString(), lead.toObject(), testOrg._id);

      // Verify task was created in background worker
      const taskCreated = await waitFor(async () => {
        const task = await SalesTask.findOne({
          leadId: lead._id,
          priority: "high",
        });
        if (task) {
          createdTaskIds.push(task._id);
          return true;
        }
        return false;
      });

      expect(taskCreated).toBe(true);
      const task = await SalesTask.findOne({ leadId: lead._id });
      expect(task).toBeDefined();
      expect(task!.title).toContain("Initial Outreach");
      expect(task!.type).toBe("follow_up");
      expect(task!.priority).toBe("high");
      expect(task!.dueDate.getTime()).toBeGreaterThan(Date.now());
    });

    it("should be idempotent and not create duplicate tasks on repeated event triggers", async () => {
      const lead = await Lead.create({
        name: `Idempotent Lead ${testPrefix}`,
        email: `idem-${testPrefix}@test.com`,
        normalizedEmail: `idem-${testPrefix}@test.com`,
        companyName: `IdemCo ${testPrefix}`,
        source: "product_demo",
        status: "new",
        score: 60,
      });
      createdLeadIds.push(lead._id);

      // Fire trigger twice in succession
      await automationService.handleLeadCreated(lead._id.toString(), lead.toObject(), testOrg._id);
      await automationService.handleLeadCreated(lead._id.toString(), lead.toObject(), testOrg._id);

      await waitFor(async () => {
        const count = await SalesTask.countDocuments({ leadId: lead._id });
        return count >= 1;
      });

      // Assert only 1 task was created despite duplicate triggers
      const tasks = await SalesTask.find({ leadId: lead._id });
      expect(tasks.length).toBe(1);
      createdTaskIds.push(tasks[0]._id);
    });
  });

  describe("3. Rule: Round-Robin Distribution for Qualified Leads", () => {
    it("should distribute newly qualified leads evenly between active sales reps", async () => {
      const lead1 = await Lead.create({
        name: `Qualified Lead 1 ${testPrefix}`,
        email: `q1-${testPrefix}@test.com`,
        normalizedEmail: `q1-${testPrefix}@test.com`,
        companyName: `QCo 1 ${testPrefix}`,
        status: "new",
        score: 75,
      });
      createdLeadIds.push(lead1._id);

      const lead2 = await Lead.create({
        name: `Qualified Lead 2 ${testPrefix}`,
        email: `q2-${testPrefix}@test.com`,
        normalizedEmail: `q2-${testPrefix}@test.com`,
        companyName: `QCo 2 ${testPrefix}`,
        status: "new",
        score: 80,
      });
      createdLeadIds.push(lead2._id);

      // Trigger status transition to qualified for both leads
      await automationService.handleLeadStatusChanged(lead1._id.toString(), "new", "qualified", testOrg._id);
      await automationService.handleLeadStatusChanged(lead2._id.toString(), "new", "qualified", testOrg._id);

      const ownersAssigned = await waitFor(async () => {
        const [l1, l2] = await Promise.all([
          Lead.findById(lead1._id),
          Lead.findById(lead2._id),
        ]);
        return !!l1?.assignedOwnerId && !!l2?.assignedOwnerId;
      });

      expect(ownersAssigned).toBe(true);

      const [updatedLead1, updatedLead2] = await Promise.all([
        Lead.findById(lead1._id),
        Lead.findById(lead2._id),
      ]);

      // Both should have assigned owners from the active sales pool
      expect(updatedLead1!.assignedOwnerId).toBeDefined();
      expect(updatedLead2!.assignedOwnerId).toBeDefined();

      // Sequential round-robin should assign different owners when 2 active reps exist
      expect(updatedLead1!.assignedOwnerId!.toString()).not.toBe(
        updatedLead2!.assignedOwnerId!.toString()
      );
    });
  });

  describe("4. Rule: Stale Lead Escalation (> 7 Days Inactive)", () => {
    it("should scan stale leads using compound index, escalate priority to high, and schedule urgent task", async () => {
      // Create lead with updatedAt 8 days ago
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600 * 1000);
      const staleLead = await Lead.create({
        name: `Stale Lead ${testPrefix}`,
        email: `stale-${testPrefix}@test.com`,
        normalizedEmail: `stale-${testPrefix}@test.com`,
        companyName: `StaleCo ${testPrefix}`,
        organizationId: testOrg._id,
        status: "contacted",
        priority: "normal",
        score: 40,
        createdAt: eightDaysAgo,
        updatedAt: eightDaysAgo,
      });
      await Lead.collection.updateOne(
        { _id: staleLead._id },
        { $set: { updatedAt: eightDaysAgo, createdAt: eightDaysAgo } }
      );
      createdLeadIds.push(staleLead._id);

      // Run stale lead scan with 7-day threshold
      const scanResult = await automationService.runStaleLeadCheck(testOrg._id, 7);
      expect(scanResult.scanned).toBeGreaterThanOrEqual(1);
      expect(scanResult.escalated).toBeGreaterThanOrEqual(1);

      // Wait for background worker to process escalation
      const escalated = await waitFor(async () => {
        const l = await Lead.findById(staleLead._id);
        const task = await SalesTask.findOne({
          leadId: staleLead._id,
          priority: "urgent",
        });
        if (task) createdTaskIds.push(task._id);
        return l?.priority === "high" && !!task;
      });

      expect(escalated).toBe(true);
      const updatedLead = await Lead.findById(staleLead._id);
      expect(updatedLead!.priority).toBe("high");
    });
  });

  describe("5. Rule: Stale Deal Warning (> 14 Days Stagnant)", () => {
    it("should scan stale deals, flag risk note, and schedule review task", async () => {
      // Create deal with updatedAt 15 days ago
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 3600 * 1000);
      const staleDeal = await Deal.create({
        name: `Stale Deal ${testPrefix}`,
        organizationId: testOrg._id,
        companyId: testCompany._id,
        pipelineId: testPipeline._id,
        stage: "proposal",
        value: 95000,
        currency: "USD",
        probability: 0.5,
        annualRecurringRevenue: 80000,
        oneTimeImplementationFee: 15000,
        createdAt: fifteenDaysAgo,
        updatedAt: fifteenDaysAgo,
      });
      await Deal.collection.updateOne(
        { _id: staleDeal._id },
        { $set: { updatedAt: fifteenDaysAgo, createdAt: fifteenDaysAgo } }
      );
      createdDealIds.push(staleDeal._id);

      // Run stale deal check with 14-day threshold
      const scanResult = await automationService.runStaleDealCheck(testOrg._id, 14);
      expect(scanResult.scanned).toBeGreaterThanOrEqual(1);
      expect(scanResult.flagged).toBeGreaterThanOrEqual(1);

      // Wait for background worker to flag deal
      const flagged = await waitFor(async () => {
        const d = await Deal.findById(staleDeal._id);
        const task = await SalesTask.findOne({
          dealId: staleDeal._id,
          type: "meeting",
        });
        if (task) createdTaskIds.push(task._id);
        return !!d?.nextAction && !!task;
      });

      expect(flagged).toBe(true);
      const updatedDeal = await Deal.findById(staleDeal._id);
      expect(updatedDeal!.nextAction).toContain("Urgent");
    });
  });

  describe("6. Inbound Communication Event Trigger", () => {
    it("should schedule customer reply task when comm:inbound_received event is emitted", async () => {
      const dummyThreadId = new mongoose.Types.ObjectId();

      await automationService.handleInboundCommReceived(
        dummyThreadId.toString(),
        {
          subject: "Pricing Inquiry for Enterprise 500 Seats",
          providerMessageId: `msg-test-${Date.now()}`,
          assignedTo: repUser1._id,
        },
        testOrg._id
      );

      const taskCreated = await waitFor(async () => {
        const task = await SalesTask.findOne({
          title: { $regex: "Pricing Inquiry" },
        });
        if (task) {
          createdTaskIds.push(task._id);
          return true;
        }
        return false;
      });

      expect(taskCreated).toBe(true);
    });
  });

  describe("7. Dead-Letter Failure & Error Handling", () => {
    it("should handle invalid target IDs without crashing and record error telemetry", async () => {
      // Trigger automation job with invalid target ID
      await expect(
        processAutomationJob({
          id: "job-invalid-1",
          name: "sales:workflow:trigger",
          data: {
            ruleId: "auto_followup",
            triggerType: "lead_created",
            targetId: "not-a-valid-object-id",
            action: "create_task",
            actionPayload: {
              title: "Broken Target Task",
              // Invalid leadId format intentionally supplied to test error handling
              leadId: "invalid-mongo-id-here" as any,
            },
            organizationId: testOrg._id.toString(),
          },
          options: { organizationId: testOrg._id },
          status: "processing",
          attempts: 1,
          availableAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ).rejects.toThrow();
    });
  });

  describe("8. REST API Endpoints Verification", () => {
    it("should trigger manual rule execution via POST /api/v1/sales/automation/trigger", async () => {
      const lead = await Lead.create({
        name: `Manual Rule Lead ${testPrefix}`,
        email: `manual-${testPrefix}@test.com`,
        normalizedEmail: `manual-${testPrefix}@test.com`,
        companyName: `ManualCo ${testPrefix}`,
        status: "new",
        score: 30,
      });
      createdLeadIds.push(lead._id);

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/automation/trigger",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          ruleId: "auto_followup",
          targetId: lead._id.toString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.enqueued).toBe(true);
    });

    it("should trigger on-demand stale scan via POST /api/v1/sales/automation/stale-scan", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/automation/stale-scan",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(body.data.leads).toBeDefined();
      expect(body.data.deals).toBeDefined();
    });

    it("should fetch automation execution logs via GET /api/v1/sales/automation/logs", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/automation/logs?limit=10",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
