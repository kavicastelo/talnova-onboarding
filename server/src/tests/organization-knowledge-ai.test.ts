import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Article from "../modules/knowledge-base/models/article.model.js";
import KnowledgeChunk from "../modules/knowledge-base/models/knowledge-chunk.model.js";
import KnowledgeGap from "../modules/knowledge-base/models/knowledge-gap.model.js";
import AIConversation from "../modules/ai/models/ai-conversation.model.js";
import KnowledgeIndexingService from "../modules/knowledge-base/services/knowledge-indexing.service.js";

describe("Organization Knowledge & Grounded AI System Test Suite", () => {
  let app: FastifyInstance;
  let indexingService: KnowledgeIndexingService;

  // Tenant A
  let orgA: any;
  let adminA: any;
  let adminAToken: string;
  let employeeA: any;
  let employeeAToken: string;
  let managerA: any;
  let managerAToken: string;

  // Tenant B
  let orgB: any;
  let employeeB: any;
  let employeeBToken: string;

  // Department IDs
  const hrDeptId = new mongoose.Types.ObjectId();
  const engDeptId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();
    indexingService = new KnowledgeIndexingService();

    const dummyAdminId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    // 1. Create Organization A
    orgA = await Organization.create({
      name: "Acme Global Tech",
      slug: `acme-global-${ts}`,
      departments: [
        { _id: hrDeptId, name: "Human Resources", code: "HR" },
        { _id: engDeptId, name: "Engineering", code: "ENG" },
      ],
      createdBy: dummyAdminId,
      isDeleted: false,
    });

    // Manager in Org A
    managerA = await User.create({
      organizationId: orgA._id,
      auth: { email: `manager-a-${ts}@acme.com`, passwordHash: "hash123" },
      profile: { firstName: "Sarah", lastName: "Connor" },
      permissions: { role: "manager" },
      employment: { departmentId: engDeptId, jobTitle: "Engineering Manager" },
    });
    managerAToken = app.jwt.sign({
      userId: managerA._id.toString(),
      organizationId: orgA._id.toString(),
      role: "manager",
    });

    // Employee in Org A (reports to Sarah Connor)
    employeeA = await User.create({
      organizationId: orgA._id,
      auth: { email: `employee-a-${ts}@acme.com`, passwordHash: "hash123" },
      profile: { firstName: "John", lastName: "Doe" },
      permissions: { role: "employee" },
      employment: {
        departmentId: engDeptId,
        managerId: managerA._id,
        jobTitle: "Software Engineer",
      },
    });
    employeeAToken = app.jwt.sign({
      userId: employeeA._id.toString(),
      organizationId: orgA._id.toString(),
      role: "employee",
    });

    // Admin in Org A
    adminA = await User.create({
      organizationId: orgA._id,
      auth: { email: `admin-a-${ts}@acme.com`, passwordHash: "hash123" },
      profile: { firstName: "Alice", lastName: "Admin" },
      permissions: { role: "admin" },
      employment: { departmentId: hrDeptId, jobTitle: "Director of HR" },
    });
    adminAToken = app.jwt.sign({
      userId: adminA._id.toString(),
      organizationId: orgA._id.toString(),
      role: "admin",
    });

    // 2. Create Organization B (Isolated Tenant)
    orgB = await Organization.create({
      name: "Beta Corp Innovations",
      slug: `beta-corp-${ts}`,
      createdBy: dummyAdminId,
      isDeleted: false,
    });

    employeeB = await User.create({
      organizationId: orgB._id,
      auth: { email: `employee-b-${ts}@beta.com`, passwordHash: "hash123" },
      profile: { firstName: "Bob", lastName: "Builder" },
      permissions: { role: "employee" },
      employment: { jobTitle: "Product Specialist" },
    });
    employeeBToken = app.jwt.sign({
      userId: employeeB._id.toString(),
      organizationId: orgB._id.toString(),
      role: "employee",
    });
  });

  afterAll(async () => {
    if (orgA) {
      await User.deleteMany({ organizationId: orgA._id });
      await Article.deleteMany({ organizationId: orgA._id });
      await KnowledgeChunk.deleteMany({ organizationId: orgA._id });
      await KnowledgeGap.deleteMany({ organizationId: orgA._id });
      await AIConversation.deleteMany({ organizationId: orgA._id });
      await Organization.deleteOne({ _id: orgA._id });
    }
    if (orgB) {
      await User.deleteMany({ organizationId: orgB._id });
      await Article.deleteMany({ organizationId: orgB._id });
      await KnowledgeChunk.deleteMany({ organizationId: orgB._id });
      await KnowledgeGap.deleteMany({ organizationId: orgB._id });
      await AIConversation.deleteMany({ organizationId: orgB._id });
      await Organization.deleteOne({ _id: orgB._id });
    }
    await app.close();
  });

  describe("1. Multi-Tenant Isolation & Partitioning", () => {
    it("should ensure Tenant A policy is NEVER retrieved by Tenant B", async () => {
      // Org A Policy: 25 Days Annual Leave
      const articleA = await Article.create({
        organizationId: orgA._id,
        title: "Acme Paid Time Off and Annual Leave Policy",
        slug: `acme-leave-policy-${Date.now()}`,
        summary: "Acme Global Tech employees receive 25 days paid annual leave.",
        content: {
          blocks: [
            {
              type: "text",
              content: "All full-time employees at Acme Global Tech receive 25 days of annual paid leave per calendar year.",
              order: 0,
            },
          ],
        },
        publishing: { status: "published", publishedAt: new Date(), version: 1 },
        createdBy: adminA._id,
      });
      await indexingService.indexArticle(articleA);

      // Org B Policy: 12 Days Annual Leave
      const articleB = await Article.create({
        organizationId: orgB._id,
        title: "Beta Corp Vacation Guidelines",
        slug: `beta-leave-policy-${Date.now()}`,
        summary: "Beta Corp provides 12 days vacation leave annually.",
        content: {
          blocks: [
            {
              type: "text",
              content: "Beta Corp provides 12 days of vacation time for regular employees.",
              order: 0,
            },
          ],
        },
        publishing: { status: "published", publishedAt: new Date(), version: 1 },
        createdBy: employeeB._id,
      });
      await indexingService.indexArticle(articleB);

      // Employee A asks:
      const resA = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "How many annual leave days do I get?" },
      });
      expect(resA.statusCode).toBe(200);
      const jsonA = resA.json();
      const msgA = jsonA.data.messages.find((m: any) => m.sender === "assistant");
      expect(msgA.content).toContain("25 days");
      expect(msgA.content).not.toContain("12 days");
      expect(msgA.citations[0].title).toBe("Acme Paid Time Off and Annual Leave Policy");

      // Employee B asks:
      const resB = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeBToken}` },
        payload: { message: "How many annual leave days do I get?" },
      });
      expect(resB.statusCode).toBe(200);
      const jsonB = resB.json();
      const msgB = jsonB.data.messages.find((m: any) => m.sender === "assistant");
      expect(msgB.content).toContain("12 days");
      expect(msgB.content).not.toContain("25 days");
      expect(msgB.citations[0].title).toBe("Beta Corp Vacation Guidelines");
    });
  });

  describe("2. Pre-Retrieval Permission & Audience Isolation", () => {
    it("should prevent unauthorized employee from retrieving HR-restricted policies", async () => {
      // Create sensitive policy restricted strictly to Human Resources department
      const hrArticle = await Article.create({
        organizationId: orgA._id,
        title: "Executive Compensation and Disciplinary Framework",
        slug: `hr-confidential-${Date.now()}`,
        summary: "Confidential procedures for executive salary reviews and performance severance.",
        content: {
          blocks: [
            {
              type: "text",
              content: "Confidential: Performance improvement plans require a 30-day severance escrow.",
              order: 0,
            },
          ],
        },
        visibility: {
          access: "department",
          departments: [hrDeptId],
        },
        publishing: { status: "published", publishedAt: new Date(), version: 1 },
        createdBy: adminA._id,
      });
      await indexingService.indexArticle(hrArticle);

      // Engineering Employee A asks about executive compensation/severance:
      const resEmployee = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "What is our executive compensation and severance escrow policy?" },
      });
      expect(resEmployee.statusCode).toBe(200);
      const jsonEmp = resEmployee.json();
      const msgEmp = jsonEmp.data.messages.find((m: any) => m.sender === "assistant");

      // Employee must NOT see the restricted policy content!
      expect(msgEmp.content).not.toContain("severance escrow");
      expect(msgEmp.content).toContain("couldn't find an approved organization resource");
      expect(msgEmp.citations.length).toBe(0);

      // Admin A (HR Admin) asks the same question:
      const resAdmin = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { message: "What is our executive compensation and severance escrow policy?" },
      });
      expect(resAdmin.statusCode).toBe(200);
      const jsonAdmin = resAdmin.json();
      const msgAdmin = jsonAdmin.data.messages.find((m: any) => m.sender === "assistant");

      // Admin has authorized access and receives grounded answer
      expect(msgAdmin.content).toContain("Executive Compensation and Disciplinary Framework");
      expect(msgAdmin.citations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("3. Structured Application Data Resolution", () => {
    it("should resolve manager and company identity directly from database without LLM/RAG", async () => {
      // Ask about direct manager
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "Who is my manager?" },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const msg = json.data.messages.find((m: any) => m.sender === "assistant");
      expect(msg.content).toContain("Sarah Connor");
      expect(msg.citations.length).toBe(0); // Structured data query, not document retrieval

      // Ask about organization name
      const resOrg = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "What is our company name?" },
      });
      expect(resOrg.statusCode).toBe(200);
      const jsonOrg = resOrg.json();
      const msgOrg = jsonOrg.data.messages.find((m: any) => m.sender === "assistant");
      expect(msgOrg.content).toContain("Acme Global Tech");
    });
  });

  describe("4. Missing Knowledge Detection & Deduplication Lifecycle", () => {
    it("should NOT hallucinate missing policies, should flag knowledge gap and deduplicate repeated asks", async () => {
      const unanswerableQuestion = "What is our international pet relocation stipend?";

      // Employee asks question with no company documentation
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: unanswerableQuestion },
      });

      expect(res1.statusCode).toBe(200);
      const json1 = res1.json();
      const msg1 = json1.data.messages.find((m: any) => m.sender === "assistant");

      // Must explicitly acknowledge missing information without hallucinating dollars or numbers
      expect(msg1.content).toContain("couldn't find an approved organization resource");
      expect(msg1.content).toContain("flagged this as missing company information");
      expect(msg1.citations.length).toBe(0);

      // Verify KnowledgeGap record was created in MongoDB
      const gap1 = await KnowledgeGap.findOne({
        organizationId: orgA._id,
        question: unanswerableQuestion,
        status: "unresolved",
      });
      expect(gap1).toBeDefined();
      expect(gap1?.occurrenceCount).toBe(1);
      expect(gap1?.requestedBy.map((id) => id.toString())).toContain(employeeA._id.toString());

      // Manager asks the exact same question
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${managerAToken}` },
        payload: { message: unanswerableQuestion },
      });
      expect(res2.statusCode).toBe(200);

      // Verify occurrence count incremented and NO duplicate ticket was created for this question
      const matchingGaps = await KnowledgeGap.find({
        organizationId: orgA._id,
        question: unanswerableQuestion,
      });
      expect(matchingGaps.length).toBe(1);
      expect(matchingGaps[0].occurrenceCount).toBe(2);
      expect(matchingGaps[0].requestedBy.map((id) => id.toString())).toContain(managerA._id.toString());
    });
  });

  describe("5. Admin Knowledge Gap Resolution & Re-indexing Workflow", () => {
    it("should allow admin to resolve gap with Quick Answer and immediately make it retrievable by AI", async () => {
      // Find unresolved gap
      const gap = await KnowledgeGap.findOne({
        organizationId: orgA._id,
        question: "What is our international pet relocation stipend?",
        status: "unresolved",
      });
      expect(gap).toBeDefined();

      // Admin resolves gap via POST /api/v1/kb/gaps/:id/quick-answer
      const resolveRes = await app.inject({
        method: "POST",
        url: `/api/v1/kb/gaps/${gap!._id}/quick-answer`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          answer: "Acme Global Tech does not offer pet relocation stipends under any standard relocation package.",
        },
      });

      expect(resolveRes.statusCode).toBe(200);
      const resolveJson = resolveRes.json();
      expect(resolveJson.success).toBe(true);
      expect(resolveJson.data.status).toBe("resolved");
      expect(resolveJson.data.resolutionType).toBe("quick_answer");

      // Employee re-asks the question
      const recheckRes = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "What is our international pet relocation stipend?" },
      });

      expect(recheckRes.statusCode).toBe(200);
      const recheckJson = recheckRes.json();
      const recheckMsg = recheckJson.data.messages.find((m: any) => m.sender === "assistant");

      // AI now accurately answers using the newly resolved quick answer!
      expect(recheckMsg.content).toContain("does not offer pet relocation stipends");
      expect(recheckMsg.citations.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("6. Resource Update & Stale Chunk Deactivation", () => {
    it("should deactivate obsolete chunks on article update and ensure updated version is returned", async () => {
      // Create initial policy: Dress code is Formal Business Suits
      const dressPolicy = await Article.create({
        organizationId: orgA._id,
        title: "Acme Office Attire Standards",
        slug: `attire-policy-${Date.now()}`,
        summary: "Office attire standards: employees must wear formal business suits.",
        content: {
          blocks: [
            {
              type: "text",
              content: "Employees must wear formal business suits and ties Monday through Friday.",
              order: 0,
            },
          ],
        },
        publishing: { status: "published", publishedAt: new Date(), version: 1 },
        createdBy: adminA._id,
      });
      await indexingService.indexArticle(dressPolicy);

      // Verify initial answer
      const q1 = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "What is our office attire standards?" },
      });
      expect(q1.json().data.messages.find((m: any) => m.sender === "assistant").content).toContain("formal business suits");

      // Update policy to Modern Smart Casual
      dressPolicy.summary = "Office attire standards: employees may wear modern smart casual.";
      dressPolicy.content.blocks[0].content = "Employees may wear modern smart casual attire every workday.";
      dressPolicy.publishing.version = 2;
      await dressPolicy.save();

      // Re-index updated article
      await indexingService.indexArticle(dressPolicy);

      // Verify old chunks are marked inactive
      const inactiveChunks = await KnowledgeChunk.find({
        resourceId: dressPolicy._id,
        status: "inactive",
      });
      expect(inactiveChunks.length).toBeGreaterThan(0);

      // AI query now retrieves the updated active policy
      const q2 = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: { authorization: `Bearer ${employeeAToken}` },
        payload: { message: "What is our office attire standards?" },
      });

      const updatedMsg = q2.json().data.messages.find((m: any) => m.sender === "assistant");
      expect(updatedMsg.content).toContain("smart casual");
      expect(updatedMsg.content).not.toContain("formal business suits");
    });
  });
});
