import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import { Article } from "../modules/knowledge-base/models/article.model.js";
import AIConversation from "../modules/ai/models/ai-conversation.model.js";

describe("Journey Test UJ-KB-002: Query AI Assistant for Policies", () => {
  let app: FastifyInstance;
  let testOrgA: any;
  let testOrgB: any;
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;

  let leaveArticleA: any;
  let travelArticleA: any;
  let secretArticleB: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const ts = Date.now();
    const dummyId = new mongoose.Types.ObjectId();

    // 1. Create Organization A
    testOrgA = await Organization.create({
      name: "Acme Policy Org A",
      slug: `acme-policy-a-${ts}`,
      domain: `acme-policy-a-${ts}.test`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Organization B
    testOrgB = await Organization.create({
      name: "Acme Policy Org B",
      slug: `acme-policy-b-${ts}`,
      domain: `acme-policy-b-${ts}.test`,
      plan: "Starter",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });

    // 3. Create User in Org A
    userA = await User.create({
      organizationId: testOrgA._id,
      auth: {
        email: `employee-a-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Emma",
        lastName: "Employee",
        fullName: "Emma Employee",
      },
      employment: {
        department: "Operations",
        jobTitle: "Operations Specialist",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    // 4. Create User in Org B
    userB = await User.create({
      organizationId: testOrgB._id,
      auth: {
        email: `employee-b-${ts}@acme.test`,
        passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$dummyhash",
      },
      profile: {
        firstName: "Liam",
        lastName: "Employee",
        fullName: "Liam Employee",
      },
      employment: {
        department: "Engineering",
        jobTitle: "Engineer",
        status: "active",
      },
      permissions: {
        role: "employee",
      },
    });

    tokenA = app.jwt.sign({
      userId: userA._id.toString(),
      role: userA.permissions.role,
      organizationId: testOrgA._id.toString(),
    });

    tokenB = app.jwt.sign({
      userId: userB._id.toString(),
      role: userB.permissions.role,
      organizationId: testOrgB._id.toString(),
    });

    // 5. Seed Leave Policy in Org A
    leaveArticleA = await Article.create({
      organizationId: testOrgA._id,
      title: "Leave & Attendance Policy",
      slug: `leave-attendance-${ts}`,
      summary: "Employees accrue 20 annual leave days per year, with 5 days allowable carry-over into next year.",
      content: {
        blocks: [
          {
            type: "callout",
            content: "Employees accrue 1.67 days of paid annual leave per completed month of service, totaling 20 business days per calendar year.",
            order: 0,
          },
        ],
      },
      tags: ["leave", "annual", "accrual", "attendance", "policy"],
      searchKeywords: ["leave", "annual", "accrual", "attendance", "vacation"],
      visibility: { access: "all" },
      publishing: { status: "published", publishedAt: new Date(), version: 1 },
      createdBy: userA._id,
      isDeleted: false,
    });

    // 6. Seed Travel Policy in Org A
    travelArticleA = await Article.create({
      organizationId: testOrgA._id,
      title: "Travel & Expense Reimbursement Policy",
      slug: `travel-expense-${ts}`,
      summary: "Guidelines for corporate travel reimbursements, itemized receipts, and per diem meals.",
      content: {
        blocks: [
          {
            type: "callout",
            content: "All travel expenses must be submitted within 30 days of completion with itemized receipts. Daily meal allowance is $75 domestic.",
            order: 0,
          },
        ],
      },
      tags: ["travel", "expense", "reimbursement", "per-diem"],
      searchKeywords: ["travel", "expense", "reimbursement", "per-diem", "receipts"],
      visibility: { access: "all" },
      publishing: { status: "published", publishedAt: new Date(), version: 1 },
      createdBy: userA._id,
      isDeleted: false,
    });

    // 7. Seed Secret Policy in Org B
    secretArticleB = await Article.create({
      organizationId: testOrgB._id,
      title: "Org B Classified Salary & Bonus Guidelines",
      slug: `org-b-secret-${ts}`,
      summary: "Confidential executive bonuses for Org B leadership.",
      content: {
        blocks: [
          {
            type: "text",
            content: "Executive compensation and bonus structure strictly restricted to Org B.",
            order: 0,
          },
        ],
      },
      tags: ["classified", "bonus", "compensation"],
      searchKeywords: ["bonus", "compensation", "salary", "classified"],
      visibility: { access: "all" },
      publishing: { status: "published", publishedAt: new Date(), version: 1 },
      createdBy: userB._id,
      isDeleted: false,
    });
  });

  afterAll(async () => {
    if (testOrgA && testOrgB) {
      await Article.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await User.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await AIConversation.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
      await Organization.deleteMany({ _id: { $in: [testOrgA._id, testOrgB._id] } });
    }
  });

  it("Step 1-4: POST /api/v1/ai/query returns HTTP 200 OK with grounded policy answer and sources", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "What is the policy on annual leave accrual?",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.answer).toBeDefined();
    expect(body.answer.length).toBeGreaterThan(20);
    expect(body.answer).toContain("Leave & Attendance Policy");

    expect(Array.isArray(body.sources)).toBe(true);
    expect(body.sources.length).toBeGreaterThanOrEqual(1);

    const source = body.sources.find((s: any) => s.title === "Leave & Attendance Policy");
    expect(source).toBeDefined();
    expect(source.id).toBe(leaveArticleA._id.toString());
    expect(source.url).toContain("/kb/");
  });

  it("Required Test Data: User queries expense reimbursements during travel and receives travel citation", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        query: "What is the policy for expense reimbursements during travel?",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);

    expect(body.success).toBe(true);
    expect(body.answer).toContain("Travel & Expense Reimbursement Policy");

    const travelSource = body.sources.find((s: any) => s.title === "Travel & Expense Reimbursement Policy");
    expect(travelSource).toBeDefined();
    expect(travelSource.id).toBe(travelArticleA._id.toString());
  });

  it("Alternative Path: User asks a follow-up question in the same chat thread", async () => {
    // 1. Initial query
    const initialRes = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "How many days of leave can I carry over?",
      },
    });

    const initialBody = JSON.parse(initialRes.body);
    const conversationId = initialBody.data._id;
    expect(conversationId).toBeDefined();

    // 2. Follow-up query in same thread
    const followUpRes = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "And what about submitting travel receipts?",
        conversationId,
      },
    });

    expect(followUpRes.statusCode).toBe(200);
    const followUpBody = JSON.parse(followUpRes.body);

    expect(followUpBody.data._id).toBe(conversationId);
    // Thread must now contain 4 messages (2 user, 2 assistant)
    expect(followUpBody.data.messages.length).toBe(4);
    expect(followUpBody.data.messages[0].content).toBe("How many days of leave can I carry over?");
    expect(followUpBody.data.messages[2].content).toBe("And what about submitting travel receipts?");
  });

  it("Negative Test: Submitting an empty query string returns HTTP 400 Bad Request", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "   ",
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.message).toContain("required");
  });

  it("Authorization & Tenant Isolation: AI never returns citations or answers from another organization", async () => {
    // User A asks about classified bonus from Org B
    const responseA = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "Tell me about classified salary bonus guidelines",
      },
    });

    const bodyA = JSON.parse(responseA.body);
    expect(bodyA.sources.length).toBe(0);
    expect(bodyA.answer).not.toContain("Org B Classified Salary");

    // User B asks about the same topic and receives Org B's article
    const responseB = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenB}`,
      },
      payload: {
        message: "Tell me about classified salary bonus guidelines",
      },
    });

    const bodyB = JSON.parse(responseB.body);
    expect(bodyB.sources.length).toBeGreaterThanOrEqual(1);
    expect(bodyB.sources[0].title).toBe("Org B Classified Salary & Bonus Guidelines");
  });

  it("Data Integrity Check: All cited sources strictly belong to the authenticated organizationId", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/ai/query",
      headers: {
        Authorization: `Bearer ${tokenA}`,
      },
      payload: {
        message: "What is the policy for leave and attendance?",
      },
    });

    const body = JSON.parse(response.body);
    for (const source of body.sources) {
      const dbArticle = await Article.findById(source.id);
      expect(dbArticle).toBeDefined();
      expect(dbArticle?.organizationId.toString()).toBe(testOrgA._id.toString());
    }
  });
});
