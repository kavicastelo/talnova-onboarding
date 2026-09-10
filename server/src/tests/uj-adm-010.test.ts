import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import SSOConfig from "../modules/auth/models/sso-config.model.js";

describe("Journey Test UJ-ADM-010: Enterprise SSO Settings Configuration", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let ownerUser: any;
  let ownerToken: string;
  let employeeUser: any;
  let employeeToken: string;

  const validCertPem = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAL9+fM0p/fQ7MA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
aWRnaXRzIFB0eSBMdGQwHhcNMjYwOTEwMjE0NTIzWhcNMjcwOTEwMjE0NTIzWjBF
MQswCQYDVQQGEwJBVTETMBEGA1UECAwKU29tZS1TdGF0ZTEhMB8GA1UECgwYSW50
ZXJuZXQgV2lkZ2l0cyBQdHkgTHRkMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB
CgKCAQEAuV3n5...
-----END CERTIFICATE-----`;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    // Clean up any stale acme.corp SSO configs
    await SSOConfig.deleteMany({ domains: "acme.corp" });

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Acme Corp Enterprise",
      slug: `acme-corp-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Owner user (manage_sso capability)
    ownerUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `owner-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Acme",
        lastName: "Owner",
      },
      permissions: {
        role: "owner",
      },
    });

    ownerToken = app.jwt.sign({
      userId: ownerUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "owner",
    });

    // 3. Create regular Employee user (no manage_sso capability)
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `employee-${ts}@acme.corp`,
        passwordHash: "argon2_mock_hash",
      },
      profile: {
        firstName: "Regular",
        lastName: "Employee",
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
  });

  afterAll(async () => {
    if (testOrg) {
      await SSOConfig.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.findByIdAndDelete(testOrg._id);
    }
    await app.close();
  });

  it("Step 1-9: Organization Owner configures SAML 2.0 parameters and saves SSO settings", async () => {
    const payload = {
      provider: "saml2",
      domains: ["acme.corp"],
      ssoUrl: "https://okta.acme.corp/app/sso",
      issuerUrl: "http://www.okta.com/exk123",
      certificate: validCertPem,
      status: "active",
      enforceSSO: false,
    };

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/sso/config",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe("saml2");
    expect(body.data.domains).toContain("acme.corp");
    expect(body.data.ssoUrl).toBe("https://okta.acme.corp/app/sso");
    expect(body.data.status).toBe("active");
    expect(body.data.certificate).toContain("BEGIN CERTIFICATE");
  });

  it("Data Integrity Check: Verifies SSOConfig and Organization.ssoConfig in MongoDB", async () => {
    // Check SSOConfig model
    const ssoDoc = await SSOConfig.findOne({ organizationId: testOrg._id });
    expect(ssoDoc).not.toBeNull();
    expect(ssoDoc?.status).toBe("active");
    expect(ssoDoc?.domains).toContain("acme.corp");
    expect(ssoDoc?.ssoUrl).toBe("https://okta.acme.corp/app/sso");
    expect(ssoDoc?.issuerUrl).toBe("http://www.okta.com/exk123");
    expect(ssoDoc?.certificate).toContain("BEGIN CERTIFICATE");

    // Check Organization.ssoConfig embedded in Organization document
    const orgDoc = await Organization.findById(testOrg._id);
    expect(orgDoc).not.toBeNull();
    expect(orgDoc?.ssoConfig).toBeDefined();
    expect(orgDoc?.ssoConfig?.enabled).toBe(true);
    expect(orgDoc?.ssoConfig?.status).toBe("active");
    expect(orgDoc?.ssoConfig?.domain).toBe("acme.corp");
    expect(orgDoc?.ssoConfig?.entryPoint).toBe("https://okta.acme.corp/app/sso");
    expect(orgDoc?.ssoConfig?.provider).toBe("saml2");
  });

  it("Integration Check: Domain discovery endpoint reflects newly configured SSO", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/sso/discover",
      payload: {
        email: "alice@acme.corp",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.ssoEnabled).toBe(true);
    expect(body.data.entryPoint).toBe("https://okta.acme.corp/app/sso");
    expect(body.data.provider).toBe("saml2");
  });

  it("Alternative Path: Toggle Enforce SSO disables standard password login for domain", async () => {
    const payload = {
      enforceSSO: true,
      domains: ["acme.corp"],
      ssoUrl: "https://okta.acme.corp/app/sso",
      status: "active",
    };

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/sso/config",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);

    const ssoDoc = await SSOConfig.findOne({ organizationId: testOrg._id });
    expect(ssoDoc?.enforceSSO).toBe(true);

    const orgDoc = await Organization.findById(testOrg._id);
    expect(orgDoc?.ssoConfig?.enforceSSO).toBe(true);
  });

  it("Negative Test: Submit invalid URL format for IdP entry point returns 400 Bad Request", async () => {
    const payload = {
      ssoUrl: "invalid-url-format",
      domains: ["acme.corp"],
    };

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/sso/config",
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/invalid.*url/i);
  });

  it("Authorization Test: Employees attempting PUT /api/v1/auth/sso/config receive HTTP 403 Forbidden", async () => {
    const payload = {
      domains: ["hacked.corp"],
      ssoUrl: "https://evil.corp/sso",
    };

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/auth/sso/config",
      headers: {
        Authorization: `Bearer ${employeeToken}`,
      },
      payload,
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.code).toBe("FORBIDDEN");
  });
});
