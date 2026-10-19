import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import SalesIntegration from "../modules/sales/models/sales-integration.model.js";
import SalesIntegrationService from "../modules/sales/services/sales-integration.service.js";

describe("FOUND-003: Sales Integrations Credential Store & Encryption", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  const service = new SalesIntegrationService();

  const testPrefix = `sales-int-${Date.now()}`;
  const createdOrgIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Sales Int Org ${testPrefix}`,
      slug: `sales-int-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `sales-int-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Int",
        lastName: "Admin",
        fullName: "Int Admin",
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
      id: superAdminUser._id.toString(),
      organizationId: testOrg._id.toString(),
      role: "super_admin",
    });
  });

  afterAll(async () => {
    // Clean up test records
    await SalesIntegration.deleteMany({
      category: { $in: ["email", "whatsapp", "ai"] },
      name: { $regex: testPrefix },
    });
    if (createdOrgIds.length > 0) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await disconnectDatabase(app.log);
    await app.close();
  });

  it("should list integrations via GET /api/v1/sales/integrations", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sales/integrations",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it("should securely store encrypted secrets via POST /api/v1/sales/integrations/email/ses", async () => {
    const plaintextSecret = "SUPER_SECRET_AWS_KEY_999";
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales/integrations/email/ses",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        name: `AWS SES ${testPrefix}`,
        enabled: true,
        publicConfig: {
          region: "us-east-1",
          fromEmail: "sales@talnova.test",
        },
        secrets: {
          accessKeyId: "AKIA_TEST_KEY",
          secretAccessKey: plaintextSecret,
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.provider).toBe("ses");
    expect(body.data.status).toBe("configured");

    // Masked secrets returned on the wire
    expect(body.data.maskedSecrets.secretAccessKey).toContain("••••••••");
    expect(body.data.maskedSecrets.secretAccessKey).not.toBe(plaintextSecret);

    // Verify database document stores encrypted cipher, NOT plaintext
    const doc = await SalesIntegration.findOne({ category: "email", provider: "ses" });
    expect(doc).toBeDefined();
    const storedEncrypted = doc!.encryptedSecrets.get("secretAccessKey");
    expect(storedEncrypted).toBeDefined();
    expect(storedEncrypted).not.toBe(plaintextSecret);
    expect(storedEncrypted).toContain(":"); // iv:authTag:cipher format
  });

  it("should never expose plaintext secrets on GET /api/v1/sales/integrations/email/ses", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/sales/integrations/email/ses",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.hasSecrets).toBe(true);
    expect(body.data.maskedSecrets.secretAccessKey).toBe("••••••••_999");
    expect(body.data.publicConfig.region).toBe("us-east-1");
  });

  it("should allow internal decryption of stored secrets for worker execution", async () => {
    const decrypted = await service.getDecryptedSecrets("email", "ses");
    expect(decrypted).toBeDefined();
    expect(decrypted!.secretAccessKey).toBe("SUPER_SECRET_AWS_KEY_999");
    expect(decrypted!.accessKeyId).toBe("AKIA_TEST_KEY");
  });

  it("should execute connection test via POST /api/v1/sales/integrations/email/ses/test", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales/integrations/email/ses/test",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {},
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data.validatedAt).toBeDefined();

    // Verify status updated to "valid"
    const doc = await SalesIntegration.findOne({ category: "email", provider: "ses" });
    expect(doc!.status).toBe("valid");
    expect(doc!.lastValidatedAt).toBeDefined();
  });

  it("should preserve existing encrypted secrets when updating config with masked placeholders", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/sales/integrations/email/ses",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
      payload: {
        publicConfig: {
          region: "eu-west-1", // Changed region
        },
        secrets: {
          secretAccessKey: "••••••••_999", // User didn't change secret
        },
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.publicConfig.region).toBe("eu-west-1");

    // Decrypt again to ensure original secret was not overwritten with placeholder
    const decrypted = await service.getDecryptedSecrets("email", "ses");
    expect(decrypted!.secretAccessKey).toBe("SUPER_SECRET_AWS_KEY_999");
  });

  it("should reset integration via DELETE /api/v1/sales/integrations/email/ses", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/api/v1/sales/integrations/email/ses",
      headers: {
        authorization: `Bearer ${superAdminToken}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const doc = await SalesIntegration.findOne({ category: "email", provider: "ses" });
    expect(doc!.status).toBe("not_configured");
    expect(doc!.enabled).toBe(false);
    expect(doc!.encryptedSecrets.size).toBe(0);
  });
});
