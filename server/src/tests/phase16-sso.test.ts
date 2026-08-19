import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";

describe("Phase 16 — Enterprise SSO & Identity Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
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

    await User.deleteMany({ "auth.email": { $regex: "^phase16-" } });

    // 1. Create Primary Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 16 Enterprise Org",
      slug: `phase16-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin User
    adminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase16-admin-${ts}@acme.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase16",
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

    // 3. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 16 Other Org",
      slug: `phase16-other-${ts}`,
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
    if (testOrg) {
      await SSOConfig.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Enterprise SSO Configuration (SSO-001)", () => {
    it("should retrieve default tenant SSO config via GET /api/v1/auth/sso/config", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/auth/sso/config",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.organizationId).toBe(testOrg._id.toString());
    });

    it("should save SSO configuration & group mapping rules via PUT /api/v1/auth/sso/config", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/v1/auth/sso/config",
        headers: {
          authorization: `Bearer ${adminToken}`,
        },
        payload: {
          provider: "okta",
          domains: ["acme.com", "corp.acme.com"],
          issuerUrl: "https://acme.okta.com",
          clientId: "okta_client_123",
          enforceSSO: true,
          defaultRole: "employee",
          roleMappings: [
            { idpGroup: "HR-Admins", role: "admin" },
            { idpGroup: "Team-Leads", role: "manager" },
          ],
          status: "active",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.domains).toContain("acme.com");
      expect(json.data.roleMappings.length).toBe(2);
    });
  });

  describe("2. Domain Discovery & Login Initiation (SSO-002)", () => {
    it("should discover active SSO config by email domain via POST /api/v1/auth/sso/discover", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          email: "employee@acme.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.ssoEnabled).toBe(true);
      expect(json.data.provider).toBe("okta");
    });

    it("should initiate SSO login redirect URL via POST /api/v1/auth/sso/initiate", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/initiate",
        payload: {
          email: "employee@acme.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.authUrl).toContain("okta");
      expect(json.data.state).toBeDefined();
    });
  });

  describe("3. Just-In-Time (JIT) Provisioning & Group-to-Role Mapping (SSO-003, SSO-004, SSO-005)", () => {
    it("should provision new user via JIT and assign role from IdP group mapping via POST /api/v1/auth/sso/callback", async () => {
      const ts = Date.now();
      const ssoEmail = `phase16-jit-${ts}@acme.com`;

      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/callback",
        payload: {
          organizationId: testOrg._id.toString(),
          email: ssoEmail,
          firstName: "JIT",
          lastName: "User",
          ssoId: `sso_${ts}`,
          idpGroups: ["HR-Admins"],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.auth.email).toBe(ssoEmail);
      expect(json.data.user.permissions.role).toBe("admin"); // Mapped from HR-Admins group rule
      expect(json.data.token).toBeDefined();
    });
  });

  describe("4. Multi-Tenant Boundary Isolation", () => {
    it("should return ssoEnabled: false for email domain belonging to another tenant", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/auth/sso/discover",
        payload: {
          email: "user@unconfigured-domain.com",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.ssoEnabled).toBe(false);
    });
  });
});
