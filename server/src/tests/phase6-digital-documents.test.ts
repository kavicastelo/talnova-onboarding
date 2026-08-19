import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import DocumentTemplate from "../modules/documents/models/document-template.model.js";
import DocumentAssignment from "../modules/documents/models/assignment.model.js"; // Wait, document-assignment.model.js!
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import documentService from "../modules/documents/services/document.service.js";

describe("Phase 6 — Digital Documents & E-Signatures Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let adminUser: any;
  let employeeUser: any;
  let adminToken: string;
  let employeeToken: string;
  let createdTemplate: any;
  let createdAssignment: any;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 6 Test Org",
      slug: `phase6-org-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase6-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase6",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "admin",
    });

    // 3. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: "phase6-employee@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "John",
        lastName: "Doe",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
      },
      permissions: {
        role: "employee",
      },
    });

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "employee",
    });

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 6 Secondary Tenant",
      slug: `phase6-other-${Date.now()}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: "other6-admin@test.com",
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    otherAdminToken = app.jwt.sign({
      userId: otherAdmin._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      const DocumentAssignmentModel = mongoose.model("DocumentAssignment");
      await DocumentAssignmentModel.deleteMany({ organizationId: testOrg._id });
      await DocumentTemplate.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Document Template Management (DOC-001)", () => {
    it("should create a document template via POST /api/v1/documents/templates", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/documents/templates",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          title: "Non-Disclosure Agreement (NDA)",
          category: "nda",
          content: "This NDA is between {{companyName}} and {{employeeName}} ({{employeeEmail}}).",
          signatureRequired: true,
          audience: {
            autoAssignNewHires: true,
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.title).toBe("Non-Disclosure Agreement (NDA)");
      createdTemplate = json.data;
    });

    it("should list document templates for the tenant organization", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/documents/templates",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. Document Assignment & Variable Interpolation (DOC-002)", () => {
    it("should assign document template to employee and interpolate user fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/documents/assign",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          templateId: createdTemplate._id,
          employeeId: employeeUser._id.toString(),
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("pending");
      expect(json.data.renderedContent).toContain("John Doe");
      createdAssignment = json.data;
    });

    it("should allow employee to fetch assigned document inbox via GET /api/v1/documents/inbox", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/documents/inbox",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. In-App E-Signature & SHA-256 Audit Trail (DOC-003, DOC-004, DOC-005)", () => {
    it("should execute e-signature and record SHA-256 checksum and audit trail", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/v1/documents/${createdAssignment._id}/sign`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          type: "type",
          signerName: "John Doe",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("signed");
      expect(json.data.signatureData.sha256Hash).toBeDefined();
      expect(json.data.signatureData.sha256Hash.length).toBe(64);
      expect(json.data.auditTrail.some((log: any) => log.action === "signed")).toBe(true);
    });
  });

  describe("4. Auto-Assignment on New Hire Creation (DOC-002)", () => {
    it("should auto-assign template to new hire when autoAssignNewHires is true", async () => {
      const newHire = await User.create({
        organizationId: testOrg._id,
        auth: {
          email: "doc-newhire@test.com",
          passwordHash: "hashedpassword123",
        },
        profile: {
          firstName: "New",
          lastName: "Hire",
        },
        permissions: {
          role: "employee",
        },
      });

      const count = await documentService.autoAssignDocumentsToNewHire(testOrg._id, newHire._id);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("5. Multi-Tenant Boundary Isolation", () => {
    it("should forbid Tenant B admin from listing Tenant A templates", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/documents/templates",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
