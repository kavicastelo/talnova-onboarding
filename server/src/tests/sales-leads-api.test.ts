import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("LEAD-001: Sales Lead Management API (CRUD, Search, Pagination)", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;

  const testPrefix = `lead-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Lead Test Org ${testPrefix}`,
      slug: `lead-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    // Super Admin User
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `lead-admin-${testPrefix}@talnova.test`,
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

    // Regular Tenant User (Role: member)
    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `lead-user-${testPrefix}@talnova.test`,
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

    regularToken = app.jwt.sign({
      userId: regularUser._id.toString(),
      email: regularUser.auth.email,
      role: regularUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
      await AuditLog.deleteMany({ resourceId: { $in: createdLeadIds } });
    }
    await Lead.deleteMany({ companyName: { $regex: testPrefix } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Route Protection & RBAC Guard", () => {
    it("should return 401 Unauthorized when no authentication token is provided", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/leads",
      });

      expect(response.statusCode).toBe(401);
    });

    it("should return 403 Forbidden when accessed by non-super_admin role", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/sales/leads",
        headers: {
          authorization: `Bearer ${regularToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("2. Payload Validation & Error Responses (HTTP 400)", () => {
    it("should return 400 with field-level details for invalid payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          // Missing name, invalid email, missing companyName
          email: "not-an-email",
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(json.details)).toBe(true);

      const fields = json.details.map((d: any) => d.field);
      expect(fields).toContain("name");
      expect(fields).toContain("email");
      expect(fields).toContain("companyName");
    });
  });

  describe("3. Lead Creation & Normalization", () => {
    let createdLeadId: string;

    it("should create a lead with normalized email and phone and write AuditLog", async () => {
      const payload = {
        name: "  Sarah Connor  ",
        email: "  SARAH.CONNOR@CyberDyne.Test  ",
        phone: "+1 (555) 839-2001",
        companyName: `Cyberdyne Systems ${testPrefix}`,
        jobTitle: "VP Engineering",
        industry: "AI Robotics",
        source: "product_demo",
        score: 65,
        priority: "high",
        estimatedBudget: 75000,
        currency: "USD",
        tags: ["enterprise", "q4-pipeline"],
      };

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.name).toBe("Sarah Connor");
      expect(json.data.email).toBe("SARAH.CONNOR@CyberDyne.Test");
      expect(json.data.normalizedEmail).toBe("sarah.connor@cyberdyne.test");
      expect(json.data.normalizedPhone).toBe("+15558392001");
      expect(json.data.status).toBe("new");
      expect(json.data.score).toBe(65);

      createdLeadId = json.data._id;
      createdLeadIds.push(new mongoose.Types.ObjectId(createdLeadId));

      // Verify AuditLog
      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(createdLeadId),
        eventType: "LEAD_CREATED",
      });
      expect(auditLog).toBeDefined();
      expect(auditLog!.action).toBe("create");
      expect(auditLog!.resourceType).toBe("sales_lead");
    });

    it("should get lead by ID", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads/${createdLeadId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data._id).toBe(createdLeadId);
      expect(json.data.companyName).toContain("Cyberdyne Systems");
    });

    it("should update lead fields and record AuditLog", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/leads/${createdLeadId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          jobTitle: "Chief Technology Officer",
          score: 85,
          priority: "urgent",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.jobTitle).toBe("Chief Technology Officer");
      expect(json.data.score).toBe(85);
      expect(json.data.priority).toBe("urgent");

      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(createdLeadId),
        eventType: "LEAD_UPDATED",
      });
      expect(auditLog).toBeDefined();
    });

    it("should update lead status with audit logging and append note", async () => {
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/leads/${createdLeadId}/status`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          status: "qualified",
          note: "Product demonstration completed successfully with positive feedback.",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("qualified");
      expect(json.data.notes.length).toBeGreaterThan(0);
      expect(json.data.notes[0].content).toContain("Product demonstration completed");

      let auditLog: any = null;
      for (let i = 0; i < 25; i++) {
        auditLog = await AuditLog.findOne({
          resourceId: new mongoose.Types.ObjectId(createdLeadId),
          eventType: "LEAD_STATUS_CHANGED",
        });
        if (auditLog) break;
        await new Promise((r) => setTimeout(r, 100));
      }

      expect(auditLog).toBeDefined();
      expect(auditLog!.metadata?.previousValue).toBe("new");
      expect(auditLog!.metadata?.newValue).toBe("qualified");
    });

    it("should add a new note via POST /api/v1/sales/leads/:id/notes", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/leads/${createdLeadId}/notes`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          content: "Follow-up meeting scheduled for next Tuesday at 2 PM EST.",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.notes.some((n: any) => n.content.includes("Follow-up meeting"))).toBe(true);
    });

    it("should delete lead and record AuditLog", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/leads/${createdLeadId}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      const findDeleted = await Lead.findById(createdLeadId);
      expect(findDeleted).toBeNull();

      const auditLog = await AuditLog.findOne({
        resourceId: new mongoose.Types.ObjectId(createdLeadId),
        eventType: "LEAD_DELETED",
      });
      expect(auditLog).toBeDefined();
    });
  });

  describe("4. Search, Multi-Field Filtering & Pagination", () => {
    beforeAll(async () => {
      // Seed test batch
      const leadsToSeed = [
        {
          name: `Alpha Lead ${testPrefix}`,
          email: `alpha.${testPrefix}@acme.test`,
          normalizedEmail: `alpha.${testPrefix}@acme.test`,
          phone: "+15550000001",
          companyName: `Acme Corp ${testPrefix}`,
          source: "website",
          status: "new",
          score: 10,
          priority: "low",
        },
        {
          name: `Beta Lead ${testPrefix}`,
          email: `beta.${testPrefix}@globex.test`,
          normalizedEmail: `beta.${testPrefix}@globex.test`,
          phone: "+15550000002",
          companyName: `Globex Corp ${testPrefix}`,
          source: "referral",
          status: "contacted",
          score: 45,
          priority: "normal",
        },
        {
          name: `Gamma Lead ${testPrefix}`,
          email: `gamma.${testPrefix}@initech.test`,
          normalizedEmail: `gamma.${testPrefix}@initech.test`,
          phone: "+15550000003",
          companyName: `Initech ${testPrefix}`,
          source: "campaign",
          status: "qualified",
          score: 90,
          priority: "urgent",
        },
      ];

      const inserted = await Lead.insertMany(leadsToSeed);
      for (const item of inserted) {
        createdLeadIds.push(item._id);
      }
    });

    it("should paginate leads with metadata (page, limit, totalPages)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads?search=${testPrefix}&page=1&limit=2`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBe(2);
      expect(json.data.pagination.total).toBe(3);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.limit).toBe(2);
      expect(json.data.pagination.totalPages).toBe(2);
      expect(json.data.pagination.hasNextPage).toBe(true);
      expect(json.data.pagination.hasPrevPage).toBe(false);
    });

    it("should filter leads by status", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads?search=${testPrefix}&status=qualified`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.items.length).toBe(1);
      expect(json.data.items[0].name).toContain("Gamma Lead");
      expect(json.data.items[0].status).toBe("qualified");
    });

    it("should filter leads by minScore", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads?search=${testPrefix}&minScore=40`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.items.length).toBe(2);
      expect(json.data.items.every((item: any) => item.score >= 40)).toBe(true);
    });

    it("should text search by company name", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/sales/leads?search=Globex`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.items.length).toBeGreaterThan(0);
      expect(json.data.items.some((item: any) => item.companyName.includes("Globex"))).toBe(true);
    });
  });
});
