import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import {
  LeadImportService,
  parseCsvRows,
  autoMapHeaders,
} from "../modules/sales/services/lead-import.service.js";

describe("LEAD-004: Lead Import (CSV) with Validation & Duplicate Check", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  const importService = new LeadImportService();

  const testPrefix = `import-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Import Test Org ${testPrefix}`,
      slug: `import-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `import-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Import",
        lastName: "Admin",
        fullName: "Import Admin",
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
    }
    await Lead.deleteMany({ companyName: { $regex: testPrefix } });
    await Lead.deleteMany({ email: { $regex: testPrefix } });
    await AuditLog.deleteMany({ "metadata.batchId": { $exists: true } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. CSV Parsing & Column Auto-Mapping Unit Logic", () => {
    it("should parse comma-delimited CSV with quotes and commas within quotes", () => {
      const csv = `Name,Email,Company,Notes\n"Smith, John",john@example.com,"Acme, Inc.","Note with, comma"`;
      const rows = parseCsvRows(csv);
      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual(["Name", "Email", "Company", "Notes"]);
      expect(rows[1][0]).toBe("Smith, John");
      expect(rows[1][2]).toBe("Acme, Inc.");
      expect(rows[1][3]).toBe("Note with, comma");
    });

    it("should auto-detect semicolon and tab delimiters", () => {
      const semiCsv = `Full Name;Work Email;Account Name\nAlice;alice@test.com;Globex`;
      const semiRows = parseCsvRows(semiCsv);
      expect(semiRows.length).toBe(2);
      expect(semiRows[0]).toEqual(["Full Name", "Work Email", "Account Name"]);

      const tabCsv = "Contact Name\tEmail Address\tCompany\nBob\tbob@test.com\tInitech";
      const tabRows = parseCsvRows(tabCsv);
      expect(tabRows.length).toBe(2);
      expect(tabRows[0]).toEqual(["Contact Name", "Email Address", "Company"]);
    });

    it("should strip UTF-8 BOM characters seamlessly", () => {
      const bomCsv = `\uFEFFName,Email,Company\nCarlos,carlos@test.com,Umbrella`;
      const rows = parseCsvRows(bomCsv);
      expect(rows[0][0]).toBe("Name");
    });

    it("should auto-map common header variations to canonical lead fields", () => {
      const headers = [
        "Full Name",
        "Work Email",
        "Mobile Number",
        "Account Name",
        "Job Title",
        "Industry Sector",
        "Company Size",
        "Estimated Budget",
      ];
      const mapping = autoMapHeaders(headers);

      expect(mapping["Full Name"]).toBe("name");
      expect(mapping["Work Email"]).toBe("email");
      expect(mapping["Mobile Number"]).toBe("phone");
      expect(mapping["Account Name"]).toBe("companyName");
      expect(mapping["Job Title"]).toBe("jobTitle");
      expect(mapping["Industry Sector"]).toBe("industry");
      expect(mapping["Company Size"]).toBe("companySize");
      expect(mapping["Estimated Budget"]).toBe("estimatedBudget");
    });
  });

  describe("2. POST /api/v1/sales/leads/import/preview", () => {
    it("should return preview headers, suggested mapping, totalRows, and sample mapped data", async () => {
      const csv = `Full Name,Work Email,Account Name,Job Title\nDavid Lee,david@preview-${testPrefix}.com,Preview Corp,Head of Sales\nSarah Connor,sarah@preview-${testPrefix}.com,Skynet Tech,VP Engineering`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/preview",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: csv,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.headers).toEqual(["Full Name", "Work Email", "Account Name", "Job Title"]);
      expect(body.data.totalRows).toBe(2);
      expect(body.data.suggestedMapping["Full Name"]).toBe("name");
      expect(body.data.suggestedMapping["Work Email"]).toBe("email");
      expect(body.data.sampleMapped.length).toBe(2);
      expect(body.data.sampleMapped[0].email).toBe(`david@preview-${testPrefix}.com`);
    });

    it("should reject empty CSV with 400 EMPTY_CSV", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/preview",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: "   ",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe("3. POST /api/v1/sales/leads/import/execute", () => {
    it("should import valid leads and report invalid rows without failing the batch", async () => {
      const csv = [
        "name,email,companyName,phone,jobTitle",
        `Valid Lead 1,valid1-${testPrefix}@test.com,Company One ${testPrefix},+15551230001,Director`,
        `Malformed Email,not-an-email,Company Two ${testPrefix},+15551230002,Manager`, // Invalid email
        `,valid3-${testPrefix}@test.com,Company Three ${testPrefix},+15551230003,Staff`, // Missing name
        `Valid Lead 2,valid2-${testPrefix}@test.com,Company Two ${testPrefix},+15551230004,VP`,
      ].join("\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/execute",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: csv,
          duplicateStrategy: "skip",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.totalRows).toBe(4);
      expect(body.data.created).toBe(2);
      expect(body.data.invalidCount).toBe(2);
      expect(body.data.errors.length).toBe(2);

      // Verify created leads in DB
      const lead1 = await Lead.findOne({ email: `valid1-${testPrefix}@test.com` });
      expect(lead1).toBeDefined();
      expect(lead1?.companyName).toContain(testPrefix);
      if (lead1) createdLeadIds.push(lead1._id);

      const lead2 = await Lead.findOne({ email: `valid2-${testPrefix}@test.com` });
      expect(lead2).toBeDefined();
      if (lead2) createdLeadIds.push(lead2._id);
    });

    it("should respect duplicateStrategy: 'skip' for existing leads", async () => {
      // Pre-create existing lead
      const existing = await Lead.create({
        name: "Existing Person",
        email: `existing-${testPrefix}@test.com`,
        normalizedEmail: `existing-${testPrefix}@test.com`,
        companyName: `Original Company ${testPrefix}`,
        jobTitle: "Founder",
        status: "new",
      });
      createdLeadIds.push(existing._id);

      const csv = [
        "name,email,companyName,jobTitle",
        `New Name,existing-${testPrefix}@test.com,Changed Company ${testPrefix},CEO`,
        `Fresh Person,fresh-${testPrefix}@test.com,Fresh Company ${testPrefix},Designer`,
      ].join("\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/execute",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: csv,
          duplicateStrategy: "skip",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.duplicatesSkipped).toBe(1);
      expect(body.data.created).toBe(1);

      // Original lead must remain untouched
      const checked = await Lead.findById(existing._id);
      expect(checked?.name).toBe("Existing Person");
      expect(checked?.companyName).toBe(`Original Company ${testPrefix}`);

      const fresh = await Lead.findOne({ email: `fresh-${testPrefix}@test.com` });
      if (fresh) createdLeadIds.push(fresh._id);
    });

    it("should respect duplicateStrategy: 'overwrite' to update existing records", async () => {
      // Pre-create existing lead
      const existing = await Lead.create({
        name: "Old Name",
        email: `overwrite-${testPrefix}@test.com`,
        normalizedEmail: `overwrite-${testPrefix}@test.com`,
        companyName: `Old Corp ${testPrefix}`,
        jobTitle: "Junior Dev",
        status: "new",
        score: 0,
      });
      createdLeadIds.push(existing._id);

      const csv = [
        "name,email,companyName,jobTitle,industry",
        `Updated Name,overwrite-${testPrefix}@test.com,Updated Corp ${testPrefix},Chief Architect,SaaS`,
      ].join("\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/execute",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: csv,
          duplicateStrategy: "overwrite",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.updated).toBe(1);
      expect(body.data.created).toBe(0);

      const updated = await Lead.findById(existing._id);
      expect(updated?.name).toBe("Updated Name");
      expect(updated?.companyName).toBe(`Updated Corp ${testPrefix}`);
      expect(updated?.jobTitle).toBe("Chief Architect");
      expect(updated?.industry).toBe("SaaS");
    });

    it("should record LEAD_IMPORT_BATCH in AuditLog with batch metadata", async () => {
      const csv = [
        "name,email,companyName",
        `Audit Lead,audit-${testPrefix}@test.com,Audit Corp ${testPrefix}`,
      ].join("\n");

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/execute",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          csvContent: csv,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const batchId = body.data.batchId;

      let auditLogFound = false;
      for (let i = 0; i < 20; i++) {
        const log = await AuditLog.findOne({
          eventType: "LEAD_IMPORT_BATCH",
          "metadata.batchId": batchId,
        });
        if (log) {
          auditLogFound = true;
          expect(log.metadata?.created).toBe(1);
          expect(log.metadata?.totalRows).toBe(1);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(auditLogFound).toBe(true);

      const created = await Lead.findOne({ email: `audit-${testPrefix}@test.com` });
      if (created) createdLeadIds.push(created._id);
    });

    it("should support multipart/form-data CSV upload for execution", async () => {
      const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
      const csvData = [
        "name,email,companyName",
        `Multipart Lead,multipart-${testPrefix}@test.com,Multipart Corp ${testPrefix}`,
      ].join("\r\n");

      const payload =
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="leads.csv"\r\n` +
        `Content-Type: text/csv\r\n\r\n` +
        `${csvData}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="duplicateStrategy"\r\n\r\n` +
        `skip\r\n` +
        `--${boundary}--\r\n`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads/import/execute",
        headers: {
          authorization: `Bearer ${superAdminToken}`,
          "content-type": `multipart/form-data; boundary=${boundary}`,
        },
        payload,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.created).toBe(1);

      const created = await Lead.findOne({ email: `multipart-${testPrefix}@test.com` });
      expect(created).toBeDefined();
      if (created) createdLeadIds.push(created._id);
    });
  });
});
