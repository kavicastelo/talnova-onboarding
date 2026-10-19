import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import DuplicateDetectionService from "../modules/sales/services/duplicate-detection.service.js";

describe("LEAD-002: Duplicate Lead Detection & Merge Engine", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  const duplicateService = new DuplicateDetectionService();

  const testPrefix = `dup-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdTaskIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Dup Test Org ${testPrefix}`,
      slug: `dup-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `dup-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
        fullName: "Super Admin",
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

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
      await AuditLog.deleteMany({ resourceId: { $in: createdLeadIds } });
    }
    if (createdTaskIds.length > 0) {
      await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    await Lead.deleteMany({ companyName: { $regex: testPrefix } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Duplicate Matching Algorithms", () => {
    let seedLead: any;

    beforeAll(async () => {
      seedLead = await Lead.create({
        name: "Jonathan Wick",
        email: `john.wick.${testPrefix}@continental.test`,
        normalizedEmail: `john.wick.${testPrefix}@continental.test`,
        phone: "+1 (555) 777-8899",
        normalizedPhone: "+15557778899",
        companyName: `Continental Hotels Group ${testPrefix}`,
        jobTitle: "Operations Consultant",
        status: "new",
        score: 60,
      });
      createdLeadIds.push(seedLead._id);
    });

    it("should match duplicate by exact normalized email", async () => {
      const results = await duplicateService.checkDuplicates({
        email: `JOHN.WICK.${testPrefix}@CONTINENTAL.TEST`,
      });

      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.lead._id.toString() === seedLead._id.toString());
      expect(match).toBeDefined();
      expect(match!.matchType).toBe("email");
      expect(match!.confidence).toBe(1.0);
    });

    it("should match duplicate by exact normalized phone", async () => {
      const results = await duplicateService.checkDuplicates({
        phone: "+1 555-777-8899",
      });

      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.lead._id.toString() === seedLead._id.toString());
      expect(match).toBeDefined();
      expect(match!.matchType).toBe("phone");
      expect(match!.confidence).toBe(0.95);
    });

    it("should fuzzy match duplicate by contact name and company name", async () => {
      const results = await duplicateService.checkDuplicates({
        name: "John Wick",
        companyName: `Continental Hotels ${testPrefix}`,
      });

      expect(results.length).toBeGreaterThan(0);
      const match = results.find((r) => r.lead._id.toString() === seedLead._id.toString());
      expect(match).toBeDefined();
      expect(match!.matchType).toBe("fuzzy");
      expect(match!.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it("should retrieve duplicate candidates via GET /api/v1/sales/leads/:id/duplicates", async () => {
      // Create duplicate candidate
      const secondLead = await Lead.create({
        name: "John Wick",
        email: `jwick.${testPrefix}@continental.test`,
        normalizedEmail: `jwick.${testPrefix}@continental.test`,
        phone: "+1 (555) 777-8899", // Matching phone
        normalizedPhone: "+15557778899",
        companyName: `Continental Hotels ${testPrefix}`,
        status: "new",
        score: 40,
      });
      createdLeadIds.push(secondLead._id);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads/${secondLead._id}/duplicates`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
      expect(json.data.some((r: any) => r.lead._id === seedLead._id.toString())).toBe(true);
    });
  });

  describe("2. Transaction-Safe Merge Workflow", () => {
    let primaryLead: any;
    let secondaryLead1: any;
    let secondaryLead2: any;
    let taskForSec1: any;
    let threadForSec2: any;

    beforeAll(async () => {
      primaryLead = await Lead.create({
        name: `Primary Lead ${testPrefix}`,
        email: `primary.${testPrefix}@acme.test`,
        normalizedEmail: `primary.${testPrefix}@acme.test`,
        companyName: `Acme Industrial ${testPrefix}`,
        status: "engaged",
        score: 50,
        tags: ["tier-1"],
        notes: [{ content: "Primary lead initial discovery call", createdAt: new Date() }],
      });
      createdLeadIds.push(primaryLead._id);

      secondaryLead1 = await Lead.create({
        name: `Secondary Lead 1 ${testPrefix}`,
        email: `sec1.${testPrefix}@acme.test`,
        normalizedEmail: `sec1.${testPrefix}@acme.test`,
        companyName: `Acme Industrial ${testPrefix}`,
        status: "new",
        score: 80,
        tags: ["webinar-attendee"],
        notes: [{ content: "Attended automated webinar session", createdAt: new Date() }],
      });
      createdLeadIds.push(secondaryLead1._id);

      secondaryLead2 = await Lead.create({
        name: `Secondary Lead 2 ${testPrefix}`,
        email: `sec2.${testPrefix}@acme.test`,
        normalizedEmail: `sec2.${testPrefix}@acme.test`,
        companyName: `Acme Industrial ${testPrefix}`,
        status: "contacted",
        score: 65,
        tags: ["inbound-form"],
        notes: [{ content: "Requested custom enterprise quote", createdAt: new Date() }],
      });
      createdLeadIds.push(secondaryLead2._id);

      // Create SalesTask pointing to secondaryLead1
      taskForSec1 = await SalesTask.create({
        title: `Task for Sec1 ${testPrefix}`,
        type: "follow_up",
        priority: "high",
        dueDate: new Date(Date.now() + 24 * 3600 * 1000),
        leadId: secondaryLead1._id,
      });
      createdTaskIds.push(taskForSec1._id);

      // Create CommThread pointing to secondaryLead2
      threadForSec2 = await CommThread.create({
        channel: "email",
        leadId: secondaryLead2._id,
        subject: `Thread with Sec2 ${testPrefix}`,
        lastMessageSnippet: "Hello, following up on custom quote",
        lastMessageAt: new Date(),
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: secondaryLead2.email,
            to: ["sales@talnova.test"],
            body: "Need custom pricing tier",
            status: "delivered",
            sentAt: new Date(),
          },
        ],
      });
      createdThreadIds.push(threadForSec2._id);
    });

    it("should merge secondary leads into primary lead with history retention and archiving", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/merge",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          primaryLeadId: primaryLead._id.toString(),
          secondaryLeadIds: [secondaryLead1._id.toString(), secondaryLead2._id.toString()],
          fieldOverrides: {
            estimatedBudget: 150000,
            priority: "urgent",
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data._id).toBe(primaryLead._id.toString());
      expect(json.data.estimatedBudget).toBe(150000);
      expect(json.data.priority).toBe("urgent");

      // Verify Primary Lead has max score (80)
      expect(json.data.score).toBe(80);

      // Verify Notes consolidation (3 total: 1 original + 2 merged)
      expect(json.data.notes.length).toBe(3);
      expect(json.data.notes.some((n: any) => n.content.includes("Attended automated webinar session"))).toBe(true);
      expect(json.data.notes.some((n: any) => n.content.includes("Requested custom enterprise quote"))).toBe(true);

      // Verify Tags union
      expect(json.data.tags).toContain("tier-1");
      expect(json.data.tags).toContain("webinar-attendee");
      expect(json.data.tags).toContain("inbound-form");

      // Verify Task reassignment
      const updatedTask = await SalesTask.findById(taskForSec1._id);
      expect(updatedTask).toBeDefined();
      expect(updatedTask!.leadId?.toString()).toBe(primaryLead._id.toString());

      // Verify CommThread reassignment
      const updatedThread = await CommThread.findById(threadForSec2._id);
      expect(updatedThread).toBeDefined();
      expect(updatedThread!.leadId?.toString()).toBe(primaryLead._id.toString());

      // Verify Secondary Leads archived as duplicates
      const sec1Check = await Lead.findById(secondaryLead1._id);
      expect(sec1Check).toBeDefined();
      expect(sec1Check!.status).toBe("duplicate");
      expect(sec1Check!.mergedIntoLeadId?.toString()).toBe(primaryLead._id.toString());

      const sec2Check = await Lead.findById(secondaryLead2._id);
      expect(sec2Check).toBeDefined();
      expect(sec2Check!.status).toBe("duplicate");
      expect(sec2Check!.mergedIntoLeadId?.toString()).toBe(primaryLead._id.toString());

      // Verify AuditLog record
      let mergeAuditLog: any = null;
      for (let i = 0; i < 20; i++) {
        mergeAuditLog = await AuditLog.findOne({
          resourceId: primaryLead._id,
          eventType: "LEAD_MERGED",
        });
        if (mergeAuditLog) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(mergeAuditLog).toBeDefined();
      expect(mergeAuditLog!.metadata?.secondaryLeadIds.length).toBe(2);
    });

    it("should reject merge if primary lead ID is in secondaryLeadIds", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/merge",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          primaryLeadId: primaryLead._id.toString(),
          secondaryLeadIds: [primaryLead._id.toString()],
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.message).toContain("Cannot merge a lead into itself");
    });

    it("should abort transaction and leave records untouched if a secondary lead cannot be found", async () => {
      const rollbackLead = await Lead.create({
        name: `Rollback Lead ${testPrefix}`,
        email: `rollback.${testPrefix}@acme.test`,
        normalizedEmail: `rollback.${testPrefix}@acme.test`,
        companyName: `Rollback Industries ${testPrefix}`,
        status: "new",
        score: 30,
        notes: [{ content: "Untouched note", createdAt: new Date() }],
      });
      createdLeadIds.push(rollbackLead._id);

      const fakeMissingId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/merge",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          primaryLeadId: rollbackLead._id.toString(),
          secondaryLeadIds: [fakeMissingId],
          fieldOverrides: { status: "converted" },
        },
      });

      expect(response.statusCode).toBe(404);

      // Verify rollbackLead was not altered
      const verifyDoc = await Lead.findById(rollbackLead._id);
      expect(verifyDoc).toBeDefined();
      expect(verifyDoc!.status).toBe("new");
      expect(verifyDoc!.notes.length).toBe(1);
      expect(verifyDoc!.notes[0].content).toBe("Untouched note");
    });
  });
});
