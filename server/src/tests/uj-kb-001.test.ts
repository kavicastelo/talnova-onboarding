import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { Article } from "../modules/knowledge-base/models/article.model.js";

describe("Journey Test UJ-KB-001: Browse KB Articles & Policy Slideshow", () => {
  let app: FastifyInstance;
  let testOrgA: any;
  let testOrgB: any;
  let adminUserA: any;
  let employeeUserA: any;
  let employeeUserB: any;
  let adminTokenA: string;
  let employeeTokenA: string;
  let employeeTokenB: string;

  let remoteWorkArticle: any;
  let otherOrgArticle: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A
    testOrgA = await Organization.create({
      name: "Acme KB Org A",
      slug: `acme-kb-a-${ts}`,
      domain: `acme-kb-a-${ts}.test`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Organization B (for tenant isolation check)
    testOrgB = await Organization.create({
      name: "Acme KB Org B",
      slug: `acme-kb-b-${ts}`,
      domain: `acme-kb-b-${ts}.test`,
      plan: "Starter",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create Admin in Org A
    adminUserA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `admin-a-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Alice",
        lastName: "Admin",
        fullName: "Alice Admin",
      },
      employment: {
        department: "HR Operations",
        jobTitle: "Head of People",
        status: "active",
      },
      permissions: {
        role: "admin",
      },
    });

    // 4. Create Employee in Org A
    employeeUserA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `emp-a-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Bob",
        lastName: "Employee",
        fullName: "Bob Employee",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Software Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 5. Create Employee in Org B
    employeeUserB = await User.create({
      organizationId: testOrgB._id,
      auth: {
        email: `emp-b-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Charlie",
        lastName: "Employee",
        fullName: "Charlie Employee",
      },
      employment: {
        department: "Operations",
        jobTitle: "Field Coordinator",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // Sign JWT tokens
    adminTokenA = app.jwt.sign({
      userId: adminUserA._id.toString(),
      role: adminUserA.permissions.role,
      organizationId: testOrgA._id.toString(),
    });

    employeeTokenA = app.jwt.sign({
      userId: employeeUserA._id.toString(),
      role: employeeUserA.permissions.role,
      organizationId: testOrgA._id.toString(),
    });

    employeeTokenB = app.jwt.sign({
      userId: employeeUserB._id.toString(),
      role: employeeUserB.permissions.role,
      organizationId: testOrgB._id.toString(),
    });

    // 6. Create required test article in Org A
    remoteWorkArticle = await Article.create({
      organizationId: testOrgA._id,
      title: "Employee Handbook & Remote Work Policy",
      slug: `employee-handbook-remote-work-${ts}`,
      summary: "Guidelines, stipends, and security protocols for remote work.",
      content: {
        blocks: [
          {
            type: "callout",
            content: "Welcome to our remote-first workplace! Please read through our flexible working policies.",
            order: 0,
          },
          {
            type: "text",
            content: "Core Collaboration Hours: 10:00 AM to 3:00 PM local time. Home office stipend: $1,000.",
            order: 1,
          },
        ],
      },
      tags: ["handbook", "remote-work", "policy"],
      visibility: { access: "all" },
      publishing: {
        status: "published",
        publishedAt: new Date(),
        version: 1,
      },
      searchKeywords: ["remote", "work", "handbook", "policy", "stipend"],
      createdBy: adminUserA._id,
      isDeleted: false,
    });

    // 7. Create article in Org B (for tenant isolation check)
    otherOrgArticle = await Article.create({
      organizationId: testOrgB._id,
      title: "Org B Secret Equipment Handbook",
      slug: `org-b-secret-${ts}`,
      summary: "Confidential handbook strictly for Org B employees.",
      content: {
        blocks: [{ type: "text", content: "Confidential content for Org B only", order: 0 }],
      },
      visibility: { access: "all" },
      publishing: { status: "published", publishedAt: new Date(), version: 1 },
      createdBy: employeeUserB._id,
      isDeleted: false,
    });
  });

  afterAll(async () => {
    if (testOrgA && testOrgB) {
      await Article.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await User.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await Organization.deleteMany({ _id: { $in: [testOrgA._id, testOrgB._id] } });
    }
  });

  it("Step 1-2: GET /api/v1/kb/articles returns HTTP 200 OK with articles list", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/kb/articles",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const found = body.data.find((a: any) => a._id === remoteWorkArticle._id.toString());
    expect(found).toBeDefined();
    expect(found.title).toBe("Employee Handbook & Remote Work Policy");
  });

  it("Step 3-4: Real-time search filters to show matching article card when searching 'Remote Work'", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/kb/articles?search=Remote%20Work",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const matchingArticle = body.data.find((a: any) => a.title.includes("Remote Work"));
    expect(matchingArticle).toBeDefined();
    expect(matchingArticle.title).toBe("Employee Handbook & Remote Work Policy");
  });

  it("Step 5: Fetching individual article details returns rich-text content blocks and metadata", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/kb/articles/${remoteWorkArticle._id}`,
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Employee Handbook & Remote Work Policy");
    expect(body.data.content.blocks.length).toBe(2);
    expect(body.data.content.blocks[0].type).toBe("callout");
    expect(body.data.content.blocks[1].content).toContain("Home office stipend");
  });

  it("Alternative Path: Admin creates and publishes a new article via POST /api/v1/kb/articles", async () => {
    const newArticleData = {
      title: "New Employee Health & Wellness Policy",
      summary: "Mental health days, gym memberships, and healthcare benefits.",
      content: {
        blocks: [
          {
            type: "text",
            content: "Every employee is entitled to 2 mental wellness days per quarter.",
            order: 0,
          },
        ],
      },
      tags: ["wellness", "benefits", "policy"],
      status: "published",
    };

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kb/articles",
      headers: {
        Authorization: `Bearer ${adminTokenA}`,
      },
      payload: newArticleData,
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.title).toBe("New Employee Health & Wellness Policy");
    expect(body.data.publishing.status).toBe("published");
  });

  it("Negative Test: Searching for gibberish keyword returns empty array without throwing error", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/kb/articles?search=xyzgibberish9824nonexistent",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it("Authorization & Tenant Isolation: Employee from Org A cannot see articles belonging to Org B", async () => {
    // Org A request
    const responseA = await app.inject({
      method: "GET",
      url: "/api/v1/kb/articles",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    const bodyA = JSON.parse(responseA.body);
    const leakedFromB = bodyA.data.find((a: any) => a._id === otherOrgArticle._id.toString());
    expect(leakedFromB).toBeUndefined();

    // Direct access to Org B's article by Org A user must return 404
    const responseDirect = await app.inject({
      method: "GET",
      url: `/api/v1/kb/articles/${otherOrgArticle._id}`,
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });
    expect(responseDirect.statusCode).toBe(404);
  });

  it("Authorization Check: Employee attempting to publish article receives HTTP 403 Forbidden", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/kb/articles",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
      payload: {
        title: "Unauthorized Employee Policy",
        content: { blocks: [] },
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("Data Integrity Check: All returned articles belong strictly to authenticated organizationId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/kb/articles",
      headers: {
        Authorization: `Bearer ${employeeTokenA}`,
      },
    });

    const body = JSON.parse(response.body);
    for (const article of body.data) {
      expect(article.organizationId).toBe(testOrgA._id.toString());
    }
  });
});
