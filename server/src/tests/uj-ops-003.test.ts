import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { Certificate } from "../modules/certificates/models/certificate.model.js";

describe("Journey Test UJ-OPS-003: Public Certificate Verification via QR", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let testUser: any;
  let validCert: any;
  let revokedCert: any;

  const validCertNumber = "cert-valid-01";
  const revokedCertNumber = "cert-revoked-01";
  const invalidCertNumber = "invalid-id-999";

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization
    testOrg = await Organization.create({
      name: "Acme Corp",
      slug: `acme-corp-${ts}`,
      domain: `acme-${ts}.test`,
      plan: "Enterprise",
      status: "Active",
      branding: {
        primaryColor: "#10B981",
        secondaryColor: "#3B82F6",
        accentColor: "#F59E0B",
      },
      certificate: {
        template: "classic",
        signatoryName: "Robert Vance",
        signatoryTitle: "Chief Operations Officer",
      },
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create User
    testUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `jane.doe-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$SuperSecretHashNotToBeLeaked",
      },
      profile: {
        firstName: "Jane",
        lastName: "Doe",
        fullName: "Jane Doe",
      },
      employment: {
        department: "Safety Operations",
        jobTitle: "Field Specialist",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // Clean up any existing cert with validCertNumber or revokedCertNumber
    await Certificate.deleteMany({
      certificateNumber: { $in: [validCertNumber, revokedCertNumber] },
    });

    // 3. Create Valid Certificate
    validCert = await Certificate.create({
      organizationId: testOrg._id,
      employeeId: testUser._id,
      certificateNumber: validCertNumber,
      recipientName: "Jane Doe",
      organizationName: "Acme Corp",
      journeyTitle: "Enterprise Compliance & Safety Certification",
      issueDate: new Date("2026-09-01T00:00:00.000Z"),
      completionDate: new Date("2026-09-01T00:00:00.000Z"),
      sha256Signature: "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
      status: "active",
    });

    // 4. Create Revoked Certificate
    revokedCert = await Certificate.create({
      organizationId: testOrg._id,
      employeeId: testUser._id,
      certificateNumber: revokedCertNumber,
      recipientName: "John Revoked",
      organizationName: "Acme Corp",
      journeyTitle: "Outdated Safety Training",
      issueDate: new Date("2026-01-15T00:00:00.000Z"),
      completionDate: new Date("2026-01-15T00:00:00.000Z"),
      sha256Signature: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      status: "revoked",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await Certificate.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
  });

  it("Step 1-3: Unauthenticated external user requests GET /public/verify/:id for valid certificate and receives HTTP 200 OK", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assignments/public/verify/${validCertNumber}`,
      // No Authorization header! Completely unauthenticated external access
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.verified).toBe(true);
    expect(body.recipientName).toBe("Jane Doe");
    expect(body.organizationName).toBe("Acme Corp");
    expect(body.credentialId).toBe("cert-valid-01");
    expect(new Date(body.issueDate).toISOString()).toBe("2026-09-01T00:00:00.000Z");

    // Also assert data subdocument contains template & branding details
    expect(body.data).toBeDefined();
    expect(body.data.recipientName).toBe("Jane Doe");
    expect(body.data.branding.orgName).toBe("Acme Corp");
    expect(body.data.certificate.signatoryName).toBe("Robert Vance");
  });

  it("Step 4 & Security Check: Zero internal sensitive PII (passwords, salts, emails) is leaked in public payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assignments/public/verify/${validCertNumber}`,
    });

    expect(response.statusCode).toBe(200);
    const rawBody = response.body;

    // Assert sensitive fields are completely absent
    expect(rawBody).not.toContain("passwordHash");
    expect(rawBody).not.toContain("SuperSecretHashNotToBeLeaked");
    expect(rawBody).not.toContain("$argon2id$");
    expect(rawBody).not.toContain("jane.doe"); // Employee private email
    expect(rawBody).not.toContain(testUser._id.toString()); // Employee internal user ID
  });

  it("Negative Test 1: Invalid certificate ID returns HTTP 404 Not Found with Invalid or Revoked Credential message", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assignments/public/verify/${invalidCertNumber}`,
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.verified).toBe(false);
    expect(body.error).toBe("INVALID_OR_REVOKED_CREDENTIAL");
    expect(body.message).toBe("Invalid or revoked credential");
  });

  it("Negative Test 2: Revoked certificate returns HTTP 404 Not Found", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assignments/public/verify/${revokedCertNumber}`,
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.verified).toBe(false);
    expect(body.error).toBe("INVALID_OR_REVOKED_CREDENTIAL");
    expect(body.message).toBe("Invalid or revoked credential");
  });

  it("Data Integrity Check: Public verified payload accurately reflects MongoDB Certificate document", async () => {
    const dbCert = await Certificate.findOne({ certificateNumber: validCertNumber });
    expect(dbCert).toBeDefined();

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/assignments/public/verify/${validCertNumber}`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.recipientName).toBe(dbCert?.recipientName);
    expect(body.organizationName).toBe(dbCert?.organizationName);
    expect(body.credentialId).toBe(dbCert?.certificateNumber);
    expect(new Date(body.issueDate).getTime()).toBe(dbCert?.issueDate.getTime());
  });
});
