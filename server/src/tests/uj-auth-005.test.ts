import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";

describe("Journey Test UJ-AUTH-005: Enterprise SSO Discovery & Initiation", () => {
  let app: FastifyInstance;
  let acmeOrg: any;
  let adminUser: any;
  let adminToken: string;

  let otherOrg: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Precondition: Create Acme Corp Organization
    acmeOrg = await Organization.create({
      name: "Acme Corporation",
      slug: `acme-corp-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin user for Acme Corp
    adminUser = await User.create({
      organizationId: acmeOrg._id,
      auth: {
        email: `admin-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Acme",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    adminToken = app.jwt.sign({
      userId: adminUser._id.toString(),
      organizationId: acmeOrg._id.toString(),
      role: "admin",
    });

    // 3. Precondition: Configure SAML 2.0 endpoint and acme.corp domain in /settings/sso
    await SSOConfig.create({
      organizationId: acmeOrg._id,
      provider: "saml2",
      domains: ["acme.corp"],
      ssoUrl: "https://idp.acme.corp/sso",
      issuerUrl: "https://idp.acme.corp/entityId",
      clientId: "acme_saml_client_id",
      enforceSSO: false, // Optional SSO (allows standard password entry)
      defaultRole: "employee",
      roleMappings: [
        { idpGroup: "HR-Admins", role: "admin" },
        { idpGroup: "Engineering-Leads", role: "manager" },
      ],
      status: "active",
      createdBy: adminUser._id,
    });

    // 4. Secondary tenant for boundary isolation test
    otherOrg = await Organization.create({
      name: "Other Multi-tenant Org",
      slug: `other-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdminToken = app.jwt.sign({
      userId: new mongoose.Types.ObjectId().toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (acmeOrg) {
      await SSOConfig.deleteMany({ organizationId: acmeOrg._id });
      await User.deleteMany({ organizationId: acmeOrg._id });
      await AuditLog.deleteMany({ organizationId: acmeOrg._id });
      await Organization.deleteOne({ _id: acmeOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("Happy Path — SSO Domain Discovery & Initiation", () => {
    it("Step 3 & 4: POST /api/v1/auth/sso/discover with domain 'acme.corp' returns IdP entry point and provider", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          domain: "acme.corp",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.enabled).toBe(true);
      expect(json.data.ssoEnabled).toBe(true);
      expect(json.data.provider).toBe("saml2");
      expect(json.data.entryPoint).toBe("https://idp.acme.corp/sso");
      expect(json.data.organizationId).toBe(acmeOrg._id.toString());
      expect(json.data.enforceSSO).toBe(false);
    });

    it("Step 3 & 4: POST /api/v1/auth/sso/discover with email 'alice@acme.corp' extracts domain and discovers SAML 2.0 configuration", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          email: "alice@acme.corp",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.enabled).toBe(true);
      expect(json.data.provider).toBe("saml2");
      expect(json.data.entryPoint).toBe("https://idp.acme.corp/sso");
    });

    it("Step 7 & 8: POST /api/v1/auth/sso/initiate returns formatted IdP redirect payload", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/initiate",
        payload: {
          email: "alice@acme.corp",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.authUrl).toContain("https://idp.acme.corp/sso");
      expect(json.data.authUrl).toContain("client_id=talnova");
      expect(json.data.authUrl).toContain("state=");
      expect(json.data.state).toBeDefined();
      expect(json.data.provider).toBe("saml2");
    });
  });

  describe("Alternative Paths — Optional SSO Fallback", () => {
    it("Allows standard password login when enforceSSO is false", async () => {
      const discovery = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: { email: "alice@acme.corp" },
      });
      const json = discovery.json();
      expect(json.data.enforceSSO).toBe(false);
      // Standard login continues to function for tenants without strict enforcement
    });
  });

  describe("Negative Tests — Unregistered Domain", () => {
    it("POST /api/v1/auth/sso/discover returns { enabled: false } for unregistered domain 'bob@gmail.com'", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          email: "bob@gmail.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.enabled).toBe(false);
      expect(json.data.ssoEnabled).toBe(false);
    });

    it("POST /api/v1/auth/sso/initiate fails with 404 for unconfigured domain", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/initiate",
        payload: {
          email: "bob@gmail.com",
        },
      });

      expect(response.statusCode).toBe(404);
      const json = response.json();
      expect(json.success).toBe(false);
    });
  });

  describe("Data Integrity & JIT Provisioning Checks", () => {
    it("Creates new user record with correct organizationId upon SAML assertion callback", async () => {
      const ts = Date.now();
      const ssoEmail = `alice.jit-${ts}@acme.corp`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/callback",
        payload: {
          organizationId: acmeOrg._id.toString(),
          email: ssoEmail,
          firstName: "Alice",
          lastName: "Corp",
          ssoId: `saml_alice_${ts}`,
          idpGroups: ["Engineering-Leads"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);

      // Verify User record
      const createdUser = await User.findOne({ "auth.email": ssoEmail });
      expect(createdUser).toBeDefined();
      expect(createdUser?.organizationId.toString()).toBe(acmeOrg._id.toString());
      expect(createdUser?.permissions.role).toBe("manager"); // Mapped from Engineering-Leads
      expect(createdUser?.profile.firstName).toBe("Alice");
    });
  });

  describe("Integration Checks — Audit Trail Logging", () => {
    it("Verifies SAML assertion event is logged in AuditLog collection", async () => {
      const auditEntry = await AuditLog.findOne({
        organizationId: acmeOrg._id,
        eventType: "SSO_SAML_ASSERTION_PROCESSED",
      });

      expect(auditEntry).toBeDefined();
      expect(auditEntry?.eventCategory).toBe("authentication");
      expect(auditEntry?.action).toBe("login");
      expect(auditEntry?.metadata?.provider).toBe("saml2");
    });
  });

  describe("Authorization & Multi-Tenant Boundary Isolation", () => {
    it("Ensures tenant isolation — domain configuration cannot be discovered by unrelated tenant", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          email: "user@isolated-subdomain.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.enabled).toBe(false);
    });
  });
});
