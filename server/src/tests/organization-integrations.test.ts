import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import OrganizationIntegration from "../modules/integrations/models/organization-integration.model.js";

describe("Organization-Level AI & Email Configuration & Capability Suite", () => {
  let app: FastifyInstance;

  // Tenant A
  let orgA: any;
  let adminA: any;
  let adminTokenA: string;
  let employeeA: any;
  let employeeTokenA: string;

  // Tenant B
  let orgB: any;
  let adminB: any;
  let adminTokenB: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A
    orgA = await Organization.create({
      name: "Tenant A Integrations Org",
      slug: `tenant-a-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Admin for Org A
    adminA = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `admin-a-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: { firstName: "Admin", lastName: "A" },
      permissions: { role: "admin" },
    });

    adminTokenA = app.jwt.sign({
      userId: adminA._id.toString(),
      organizationId: orgA._id.toString(),
      role: "admin",
    });

    // 3. Create Employee for Org A
    employeeA = await User.create({
      organizationId: orgA._id,
      auth: {
        email: `employee-a-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: { firstName: "Employee", lastName: "A" },
      permissions: { role: "employee" },
    });

    employeeTokenA = app.jwt.sign({
      userId: employeeA._id.toString(),
      organizationId: orgA._id.toString(),
      role: "employee",
    });

    // 4. Create Organization B
    orgB = await Organization.create({
      name: "Tenant B Integrations Org",
      slug: `tenant-b-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 5. Create Admin for Org B
    adminB = await User.create({
      organizationId: orgB._id,
      auth: {
        email: `admin-b-${ts}@test.com`,
        passwordHash: "hashedpass123",
      },
      profile: { firstName: "Admin", lastName: "B" },
      permissions: { role: "admin" },
    });

    adminTokenB = app.jwt.sign({
      userId: adminB._id.toString(),
      organizationId: orgB._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (orgA?._id) {
      await OrganizationIntegration.deleteMany({ organizationId: orgA._id });
      await User.deleteMany({ organizationId: orgA._id });
      await Organization.deleteOne({ _id: orgA._id });
    }
    if (orgB?._id) {
      await OrganizationIntegration.deleteMany({ organizationId: orgB._id });
      await User.deleteMany({ organizationId: orgB._id });
      await Organization.deleteOne({ _id: orgB._id });
    }
    await app.close();
  });

  describe("1. Role-Based Access Control (RBAC)", () => {
    it("should allow any authenticated user to view organization capabilities", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/capabilities",
        headers: { authorization: `Bearer ${employeeTokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.ai).toBeDefined();
      expect(json.data.email).toBeDefined();
    });

    it("should forbid regular employees from retrieving integration secrets/settings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${employeeTokenA}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it("should forbid regular employees from saving integration configuration", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${employeeTokenA}` },
        payload: {
          provider: "openai",
          publicConfig: { model: "gpt-4o" },
          secrets: { apiKey: "sk-malicious-key" },
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it("should reject unauthenticated requests with 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/ai",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("2. AI Configuration & Secret Sanitization", () => {
    it("should allow organization admin to save AI configuration with encrypted API key", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          provider: "openai",
          enabled: true,
          publicConfig: { model: "gpt-4o-mini" },
          secrets: { apiKey: "sk-proj-testSecretApiKey1234567890abcd" },
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.provider).toBe("openai");
      expect(json.data.hasSecret).toBe(true);
      // Secrets MUST NOT be exposed
      expect(json.data.maskedSecret).toBe("••••••••abcd");
      expect(json.data.encryptedConfig).toBeUndefined();
      expect(json.data.apiKey).toBeUndefined();
    });

    it("should not return plaintext secrets when retrieving saved AI configuration", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.hasSecret).toBe(true);
      expect(json.data.maskedSecret).toContain("••••••••");
      expect(JSON.stringify(json)).not.toContain("sk-proj-testSecretApiKey1234567890abcd");
    });

    it("should retain existing secret when updating public settings without providing new secret", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          provider: "openai",
          publicConfig: { model: "gpt-4o" }, // Changed model
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.publicConfig.model).toBe("gpt-4o");
      expect(json.data.hasSecret).toBe(true);
      expect(json.data.maskedSecret).toBe("••••••••abcd"); // Preserved
    });

    it("should test AI connection and update validation status", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/organizations/integrations/ai/test",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          provider: "openai",
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data).toBeDefined();
      expect(typeof json.data.latencyMs).toBe("number");
    });
  });

  describe("3. Email Configuration & Secret Sanitization", () => {
    it("should allow organization admin to configure SMTP email delivery", async () => {
      const res = await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/email",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          provider: "smtp",
          enabled: true,
          publicConfig: {
            host: "smtp.mailgun.org",
            port: 587,
            user: "postmaster@tenanta.com",
            fromEmail: "onboarding@tenanta.com",
            fromName: "Tenant A Onboarding Team",
            secure: false,
          },
          secrets: {
            password: "superSecretSmtpPassword9999",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.success).toBe(true);
      expect(json.data.provider).toBe("smtp");
      expect(json.data.publicConfig.fromEmail).toBe("onboarding@tenanta.com");
      expect(json.data.hasSecret).toBe(true);
      expect(json.data.maskedSecret).toBe("••••••••9999");
      expect(JSON.stringify(json)).not.toContain("superSecretSmtpPassword9999");
    });

    it("should test email connection verification", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/organizations/integrations/email/test",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          provider: "smtp",
          targetEmail: "test-verify@tenanta.com",
        },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      expect(json.data.success).toBe(true);
      expect(typeof json.data.latencyMs).toBe("number");
    });
  });

  describe("4. Multi-Tenant Boundary Isolation", () => {
    it("should ensure Tenant B cannot see Tenant A's integration configuration", async () => {
      // Tenant B queries email integration
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/email",
        headers: { authorization: `Bearer ${adminTokenB}` },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      // Tenant B should see unconfigured integration
      expect(json.data.configured).toBe(false);
      expect(json.data.hasSecret).toBe(false);
      expect(json.data.publicConfig.fromEmail).toBeUndefined();
    });

    it("should ensure Tenant B cannot mutate Tenant A's configuration", async () => {
      // Tenant B saves its own AI config
      await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenB}` },
        payload: {
          provider: "gemini",
          publicConfig: { model: "gemini-1.5-pro" },
          secrets: { apiKey: "tenant-b-gemini-key-7777" },
        },
      });

      // Tenant A's AI config should remain OpenAI
      const resA = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenA}` },
      });

      const jsonA = resA.json();
      expect(jsonA.data.provider).toBe("openai");
      expect(jsonA.data.publicConfig.model).toBe("gpt-4o");
      expect(jsonA.data.maskedSecret).toBe("••••••••abcd");

      // Tenant B's AI config should be Gemini
      const resB = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenB}` },
      });

      const jsonB = resB.json();
      expect(jsonB.data.provider).toBe("gemini");
      expect(jsonB.data.publicConfig.model).toBe("gemini-1.5-pro");
      expect(jsonB.data.maskedSecret).toBe("••••••••7777");
    });

    it("should isolate capabilities per organization", async () => {
      const resA = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/capabilities",
        headers: { authorization: `Bearer ${employeeTokenA}` },
      });

      const jsonA = resA.json();
      expect(jsonA.data.ai.provider).toBe("openai");
      expect(jsonA.data.email.provider).toBe("smtp");
      expect(jsonA.data.email.fromEmail).toBe("onboarding@tenanta.com");
    });
  });

  describe("5. Capability Gating & Disabling", () => {
    it("should reflect disabled status in capabilities when integration is toggled off", async () => {
      // Admin disables AI integration
      await app.inject({
        method: "PUT",
        url: "/api/v1/organizations/integrations/ai",
        headers: { authorization: `Bearer ${adminTokenA}` },
        payload: {
          enabled: false,
          provider: "openai",
        },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/organizations/integrations/capabilities",
        headers: { authorization: `Bearer ${employeeTokenA}` },
      });

      const json = res.json();
      expect(json.data.ai.enabled).toBe(false);
    });
  });
});
