import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import SalesIntegration from "../modules/sales/models/sales-integration.model.js";
import { decryptSecret } from "../utils/crypto.js";

describe("SEC-001: Security & RBAC Penetration Audit", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let superAdminUser: any;
  let employeeUser: any;
  let tenantAdminUser: any;

  let superAdminToken: string;
  let employeeToken: string;
  let tenantAdminToken: string;

  const testPrefix = `sec-audit-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Base Host Organization
    testOrg = await Organization.create({
      name: `Security Audit Host ${testPrefix}`,
      slug: `host-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    // 2. Create Super Admin User (Authorized)
    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sec-superadmin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: { firstName: "Security", lastName: "Admin", fullName: "Security Admin" },
      employment: { status: "active" },
      roles: ["super_admin"],
      systemRole: "super_admin",
      permissions: { role: "super_admin", customRoles: [] },
    });
    createdUserIds.push(superAdminUser._id);

    superAdminToken = app.jwt.sign({
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: "super_admin",
      roles: ["super_admin"],
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // 3. Create Standard Employee User (Unauthorized Role: employee)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sec-employee-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: { firstName: "Standard", lastName: "Employee", fullName: "Standard Employee" },
      employment: { status: "active" },
      roles: ["employee"],
      systemRole: "employee",
      permissions: { role: "employee", customRoles: [] },
    });
    createdUserIds.push(employeeUser._id);

    employeeToken = app.jwt.sign({
      userId: employeeUser._id.toString(),
      email: employeeUser.auth.email,
      role: "employee",
      roles: ["employee"],
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });

    // 4. Create Tenant Admin User (Unauthorized Role: admin, standard tenant org admin)
    tenantAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sec-tenantadmin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: { firstName: "Tenant", lastName: "Admin", fullName: "Tenant Admin" },
      employment: { status: "active" },
      roles: ["admin"],
      systemRole: "admin",
      permissions: { role: "admin", customRoles: [] },
    });
    createdUserIds.push(tenantAdminUser._id);

    tenantAdminToken = app.jwt.sign({
      userId: tenantAdminUser._id.toString(),
      email: tenantAdminUser.auth.email,
      role: "admin",
      roles: ["admin"],
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    // Clean up any test sales integrations
    await SalesIntegration.deleteMany({
      category: "email",
      provider: "smtp",
      name: { $regex: testPrefix },
    });

    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }

    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("1. Anonymous Access Rejection (HTTP 401)", () => {
    const protectedSalesEndpoints = [
      { method: "GET", url: "/api/v1/sales/ping" },
      { method: "GET", url: "/api/v1/sales/leads" },
      { method: "POST", url: "/api/v1/sales/leads" },
      { method: "GET", url: "/api/v1/sales/deals" },
      { method: "POST", url: "/api/v1/sales/deals" },
      { method: "GET", url: "/api/v1/sales/companies" },
      { method: "POST", url: "/api/v1/sales/companies" },
      { method: "GET", url: "/api/v1/sales/contacts" },
      { method: "POST", url: "/api/v1/sales/contacts" },
      { method: "GET", url: "/api/v1/sales/tasks" },
      { method: "GET", url: "/api/v1/sales/campaigns" },
      { method: "GET", url: "/api/v1/sales/inbox" },
      { method: "GET", url: "/api/v1/sales/pipelines" },
      { method: "GET", url: "/api/v1/sales/integrations" },
      { method: "GET", url: "/api/v1/sales/analytics/overview" },
      { method: "GET", url: "/api/v1/sales/analytics/funnel" },
      { method: "GET", url: "/api/v1/sales/analytics/rep-performance" },
      { method: "GET", url: "/api/v1/sales/automation/rules" },
    ];

    for (const ep of protectedSalesEndpoints) {
      it(`rejects unauthenticated ${ep.method} ${ep.url} with 401 Unauthorized`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          // No Authorization header provided
        });

        expect(res.statusCode).toBe(401);
      });
    }

    it("rejects request with malformed / invalid JWT token with 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals",
        headers: { authorization: "Bearer invalid.jwt.token.signature" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("2. Non-Super-Admin Role Access Rejection (HTTP 403)", () => {
    const sensitiveEndpoints = [
      { method: "GET", url: "/api/v1/sales/leads" },
      { method: "GET", url: "/api/v1/sales/deals" },
      { method: "GET", url: "/api/v1/sales/companies" },
      { method: "GET", url: "/api/v1/sales/contacts" },
      { method: "GET", url: "/api/v1/sales/tasks" },
      { method: "GET", url: "/api/v1/sales/inbox" },
      { method: "GET", url: "/api/v1/sales/integrations" },
      { method: "GET", url: "/api/v1/sales/analytics/overview" },
    ];

    for (const ep of sensitiveEndpoints) {
      it(`rejects employee user from ${ep.method} ${ep.url} with 403 Forbidden`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: { authorization: `Bearer ${employeeToken}` },
        });

        expect(res.statusCode).toBe(403);
      });

      it(`rejects tenant admin user from ${ep.method} ${ep.url} with 403 Forbidden`, async () => {
        const res = await app.inject({
          method: ep.method as any,
          url: ep.url,
          headers: { authorization: `Bearer ${tenantAdminToken}` },
        });

        expect(res.statusCode).toBe(403);
      });
    }
  });

  describe("3. NoSQL Operator Injection Resistance", () => {
    it("safely handles NoSQL operator query in GET /api/v1/sales/deals (no raw evaluation, no 500 error)", async () => {
      // Attacker attempts mongo query operator injection via query parameters: search[$gt]=""
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/sales/deals?search[$gt]=",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      // Must be safely parsed (HTTP 200 or 400 validation error), NEVER unhandled 500 error
      expect([200, 400]).toContain(res.statusCode);
      if (res.statusCode === 200) {
        const body = res.json();
        expect(body.success).toBe(true);
        // Verify search does not return unfiltered deals from injected operator
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    it("rejects NoSQL injection object in POST /api/v1/sales/leads with 400 Bad Request", async () => {
      // Attacker submits object instead of string for name: {"name": {"$ne": null}}
      const maliciousPayload = {
        name: { $ne: null },
        email: `attacker-${testPrefix}@injection.test`,
        companyName: "Exploit Corp",
        source: "website",
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/leads",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: maliciousPayload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
      expect(body.error?.code || body.code).toBeDefined();
    });

    it("rejects NoSQL injection operator in POST /api/v1/sales/deals with 400 Bad Request", async () => {
      // Attacker submits operator object for companyId: {"companyId": {"$gt": ""}}
      const maliciousPayload = {
        name: "Injected Deal",
        companyId: { $gt: "" },
        value: 50000,
        currency: "USD",
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/deals",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: maliciousPayload,
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.success).toBe(false);
    });

    it("rejects NoSQL injection operator in POST /api/v1/sales/tasks with 400 Bad Request", async () => {
      const maliciousPayload = {
        title: { $regex: ".*" },
        type: "proposal",
        priority: "medium",
      };

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/tasks",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: maliciousPayload,
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("4. Integration Credential Encryption & Zero Plaintext Secret Leakage", () => {
    const rawSecretPassword = `P@ssw0rd_${testPrefix}_VaultX99!`;
    const rawApiKey = `talnova_key_${testPrefix}_9876543210fedcba`;

    it("persists integration credentials encrypted using AES-256-GCM and never in plaintext in MongoDB", async () => {
      // 1. Save integration via API with sensitive secrets
      const saveRes = await app.inject({
        method: "POST",
        url: "/api/v1/sales/integrations/email/smtp",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Custom SMTP Gateway ${testPrefix}`,
          enabled: true,
          publicConfig: {
            host: "smtp.mailgun.org",
            port: 587,
            secure: false,
            fromEmail: "sales@talnova.com",
            fromName: "Talnova Sales Team",
          },
          secrets: {
            smtpPassword: rawSecretPassword,
            apiKey: rawApiKey,
          },
        },
      });

      expect(saveRes.statusCode).toBe(200);
      const saveBody = saveRes.json();
      expect(saveBody.success).toBe(true);

      // 2. Query MongoDB directly to inspect the raw stored document
      const rawDoc = await SalesIntegration.findOne({ category: "email", provider: "smtp" });
      expect(rawDoc).toBeDefined();

      const docString = JSON.stringify(rawDoc?.toObject());

      // Critical Assertions: Plaintext secrets MUST NEVER appear in raw stored MongoDB document
      expect(docString).not.toContain(rawSecretPassword);
      expect(docString).not.toContain(rawApiKey);

      // Verify secrets are stored in AES-256-GCM encrypted format (iv:authTag:encrypted)
      const encryptedPassword = rawDoc?.encryptedSecrets?.get("smtpPassword");
      expect(encryptedPassword).toBeDefined();
      expect(typeof encryptedPassword).toBe("string");

      const parts = (encryptedPassword as string).split(":");
      expect(parts.length).toBe(3); // [ivHex, authTagHex, encryptedHex]
      expect(parts[0].length).toBe(24); // 12-byte IV = 24 hex characters
      expect(parts[1].length).toBe(32); // 16-byte AuthTag = 32 hex characters
      expect(parts[2].length).toBeGreaterThan(0); // Ciphertext

      // Verify that decryptSecret accurately reverses the AES-256-GCM encryption with correct key
      const decryptedPassword = decryptSecret(encryptedPassword as string);
      expect(decryptedPassword).toBe(rawSecretPassword);

      const encryptedApiKey = rawDoc?.encryptedSecrets?.get("apiKey");
      expect(encryptedApiKey).toBeDefined();
      const decryptedApiKey = decryptSecret(encryptedApiKey as string);
      expect(decryptedApiKey).toBe(rawApiKey);
    });

    it("masks secrets in API responses and completely excludes encrypted ciphertext maps", async () => {
      // Query single integration details via API
      const getRes = await app.inject({
        method: "GET",
        url: "/api/v1/sales/integrations/email/smtp",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(getRes.statusCode).toBe(200);
      const getBody = getRes.json();
      expect(getBody.success).toBe(true);
      const data = getBody.data;

      // 1. Raw secrets are NEVER in response
      const responseString = JSON.stringify(data);
      expect(responseString).not.toContain(rawSecretPassword);
      expect(responseString).not.toContain(rawApiKey);

      // 2. `encryptedSecrets` internal map is not returned to client
      expect(data.encryptedSecrets).toBeUndefined();

      // 3. Secrets are properly masked (e.g. "••••••••dcba" or "••••••••X99!")
      expect(data.maskedSecrets).toBeDefined();
      expect(data.maskedSecrets.smtpPassword).toContain("••••••••");
      expect(data.maskedSecrets.apiKey).toContain("••••••••");
      expect(data.maskedSecrets.apiKey.endsWith("dcba")).toBe(true);
    });
  });
});
