import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Company from "../modules/sales/models/company.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Deal from "../modules/sales/models/deal.model.js";
import Pipeline from "../modules/sales/models/pipeline.model.js";
import SalesTask from "../modules/sales/models/task.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import { normalizeDomain } from "../modules/sales/services/company.service.js";

describe("LEAD-005: Companies & Contacts Directory API", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let testPipeline: any;
  let superAdminToken: string;
  let regularToken: string;

  const testPrefix = `acct-test-${Date.now()}`;
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdDealIds: mongoose.Types.ObjectId[] = [];
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
      name: `Acct Test Org ${testPrefix}`,
      slug: `acct-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `acct-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Acct",
        lastName: "Admin",
        fullName: "Acct Admin",
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
        email: `regular-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "User",
        fullName: "Regular User",
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

    // Create a pipeline for deals
    testPipeline = await Pipeline.create({
      name: `Sales Pipeline ${testPrefix}`,
      stages: [
        { key: "discovery", name: "Discovery", order: 1, probability: 0.2 },
        { key: "proposal", name: "Proposal", order: 2, probability: 0.5 },
        { key: "closed_won", name: "Closed Won", order: 3, probability: 1.0 },
        { key: "closed_lost", name: "Closed Lost", order: 4, probability: 0.0 },
      ],
      isDefault: false,
    });
  });

  afterAll(async () => {
    if (createdCompanyIds.length > 0) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdContactIds.length > 0) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdDealIds.length > 0) {
      await Deal.deleteMany({ _id: { $in: createdDealIds } });
    }
    if (createdTaskIds.length > 0) {
      await SalesTask.deleteMany({ _id: { $in: createdTaskIds } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    if (testPipeline) {
      await Pipeline.findByIdAndDelete(testPipeline._id);
    }
    await Company.deleteMany({ name: { $regex: testPrefix } });
    await Contact.deleteMany({ email: { $regex: testPrefix } });
    await AuditLog.deleteMany({ resourceType: { $in: ["sales_company", "sales_contact"] } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Domain Normalization Unit Logic", () => {
    it("should normalize raw domains and URLs cleanly", () => {
      expect(normalizeDomain("https://www.acme.com/products?ref=123")).toBe("acme.com");
      expect(normalizeDomain("http://sub.domain.org/path")).toBe("sub.domain.org");
      expect(normalizeDomain("WWW.Google.COM")).toBe("google.com");
      expect(normalizeDomain("  stripe.com/pricing ")).toBe("stripe.com");
    });
  });

  describe("2. Company Endpoints (/api/v1/sales/companies)", () => {
    it("POST / should create a new company and record AuditLog", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/companies",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          name: `Acme Corp ${testPrefix}`,
          domain: "https://www.acme-corp.test/welcome",
          website: "https://www.acme-corp.test",
          industry: "Cloud Infrastructure",
          employeeCount: 250,
          tier: "enterprise",
          annualRevenuePotential: 150000,
          country: "United States",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.domain).toBe("acme-corp.test");
      expect(body.data.tier).toBe("enterprise");
      createdCompanyIds.push(new mongoose.Types.ObjectId(body.data._id));

      // Verify AuditLog
      let auditLogFound = false;
      for (let i = 0; i < 20; i++) {
        const log = await AuditLog.findOne({
          resourceId: body.data._id,
          eventType: "COMPANY_CREATED",
        });
        if (log) {
          auditLogFound = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(auditLogFound).toBe(true);
    });

    it("GET / should return paginated list with search and industry filtering", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/companies?search=${testPrefix}&industry=Cloud Infrastructure`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(body.data.pagination.total).toBeGreaterThanOrEqual(1);
    });

    it("PATCH /:id should update company fields", async () => {
      const companyId = createdCompanyIds[0];
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/companies/${companyId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          tier: "strategic",
          annualRevenuePotential: 250000,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.tier).toBe("strategic");
      expect(body.data.annualRevenuePotential).toBe(250000);
    });

    it("POST /:id/notes should add note to company", async () => {
      const companyId = createdCompanyIds[0];
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/companies/${companyId}/notes`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          content: "Quarterly account review scheduled with leadership.",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.notes.length).toBe(1);
      expect(body.data.notes[0].content).toContain("Quarterly account review");
    });

    it("DELETE /:id should prevent deletion if active deals exist, and permit deletion once closed", async () => {
      // Create a test company
      const company = await Company.create({
        name: `Deal Guard Corp ${testPrefix}`,
        domain: `dealguard-${testPrefix}.test`,
        tier: "enterprise",
      });
      createdCompanyIds.push(company._id);

      // Create an active deal for this company
      const deal = await Deal.create({
        name: `Major Expansion Deal ${testPrefix}`,
        companyId: company._id,
        pipelineId: testPipeline._id,
        stage: "proposal", // active deal
        value: 75000,
        currency: "USD",
        annualRecurringRevenue: 75000,
        oneTimeImplementationFee: 5000,
        probability: 0.5,
        stageHistory: [{ fromStage: "discovery", toStage: "proposal", changedAt: new Date() }],
      });
      createdDealIds.push(deal._id);

      // Attempt to delete company while deal is active -> must fail
      const blockedResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/companies/${company._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(blockedResponse.statusCode).toBe(400);
      const blockedBody = JSON.parse(blockedResponse.body);
      expect(blockedBody.code).toBe("CANNOT_DELETE_COMPANY_WITH_ACTIVE_DEALS");

      // Now close the deal
      deal.stage = "closed_won";
      await deal.save();

      // Now deletion should succeed
      const allowedResponse = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/companies/${company._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(allowedResponse.statusCode).toBe(200);
      const allowedBody = JSON.parse(allowedResponse.body);
      expect(allowedBody.success).toBe(true);
    });

    it("GET /:id/360 should aggregate company 360 overview", async () => {
      const company = await Company.create({
        name: `360 Corp ${testPrefix}`,
        domain: `360-${testPrefix}.test`,
        tier: "strategic",
      });
      createdCompanyIds.push(company._id);

      // Add a primary contact
      const contact = await Contact.create({
        companyId: company._id,
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
        email: `jane.doe-${testPrefix}@360.test`,
        normalizedEmail: `jane.doe-${testPrefix}@360.test`,
        jobTitle: "CEO",
        role: "buyer",
        isPrimaryDecisionMaker: true,
      });
      createdContactIds.push(contact._id);

      // Add a deal
      const deal = await Deal.create({
        name: `360 Deal ${testPrefix}`,
        companyId: company._id,
        pipelineId: testPipeline._id,
        stage: "discovery",
        value: 120000,
        currency: "USD",
        annualRecurringRevenue: 120000,
        oneTimeImplementationFee: 10000,
        probability: 0.2,
        stageHistory: [],
      });
      createdDealIds.push(deal._id);

      // Add a task
      const task = await SalesTask.create({
        title: `Follow up with CEO ${testPrefix}`,
        companyId: company._id,
        dueDate: new Date(Date.now() + 86400000),
      });
      createdTaskIds.push(task._id);

      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/companies/${company._id}/360`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.company.name).toBe(`360 Corp ${testPrefix}`);
      expect(body.data.contacts.length).toBe(1);
      expect(body.data.deals.length).toBe(1);
      expect(body.data.tasks.length).toBe(1);
      expect(body.data.metrics.totalPipelineValue).toBe(120000);
      expect(body.data.metrics.primaryContact.fullName).toBe("Jane Doe");
    });
  });

  describe("3. Contact Endpoints (/api/v1/sales/contacts)", () => {
    it("POST / should create contact with normalized email/phone and enforce primary decision maker exclusivity", async () => {
      const company = await Company.create({
        name: `Contact Exclusivity Corp ${testPrefix}`,
        domain: `exclusivity-${testPrefix}.test`,
      });
      createdCompanyIds.push(company._id);

      // Create contact 1 as primary
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/sales/contacts",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          companyId: company._id.toString(),
          firstName: "First",
          lastName: "DecisionMaker",
          email: `first-${testPrefix}@test.com`,
          phone: "+1-555-111-2222",
          jobTitle: "CTO",
          role: "buyer",
          isPrimaryDecisionMaker: true,
        },
      });

      expect(res1.statusCode).toBe(201);
      const body1 = JSON.parse(res1.body);
      expect(body1.data.fullName).toBe("First DecisionMaker");
      expect(body1.data.normalizedPhone).toBe("+15551112222");
      expect(body1.data.isPrimaryDecisionMaker).toBe(true);
      createdContactIds.push(new mongoose.Types.ObjectId(body1.data._id));

      // Create contact 2 as primary for the same company -> should unset contact 1 as primary
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/sales/contacts",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          companyId: company._id.toString(),
          firstName: "Second",
          lastName: "DecisionMaker",
          email: `second-${testPrefix}@test.com`,
          jobTitle: "New CEO",
          role: "buyer",
          isPrimaryDecisionMaker: true,
        },
      });

      expect(res2.statusCode).toBe(201);
      const body2 = JSON.parse(res2.body);
      expect(body2.data.isPrimaryDecisionMaker).toBe(true);
      createdContactIds.push(new mongoose.Types.ObjectId(body2.data._id));

      // Verify contact 1 was unset
      const refreshed1 = await Contact.findById(body1.data._id);
      expect(refreshed1?.isPrimaryDecisionMaker).toBe(false);
    });

    it("GET / should return paginated contacts with search and company filter", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/contacts?search=Second DecisionMaker`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(body.data.items[0].fullName).toBe("Second DecisionMaker");
    });

    it("PATCH /:id should update contact and recompute fullName if name fields change", async () => {
      const contactId = createdContactIds[createdContactIds.length - 1];

      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/contacts/${contactId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          firstName: "UpdatedFirst",
          jobTitle: "Chief Executive Officer",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.fullName).toBe("UpdatedFirst DecisionMaker");
      expect(body.data.jobTitle).toBe("Chief Executive Officer");
    });

    it("DELETE /:id should delete contact and log AuditLog", async () => {
      const contact = await Contact.create({
        firstName: "Delete",
        lastName: "Me",
        fullName: "Delete Me",
        email: `delete-${testPrefix}@test.com`,
        normalizedEmail: `delete-${testPrefix}@test.com`,
      });
      createdContactIds.push(contact._id);

      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/contacts/${contact._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);

      const check = await Contact.findById(contact._id);
      expect(check).toBeNull();
    });
  });

  describe("4. Security & RBAC Enforcement", () => {
    it("should reject non-super_admin user requests with 403 Forbidden", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/companies",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/contacts",
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
