import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { FastifyInstance } from "fastify";
import buildApp from "../app.js";
import { connectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Article from "../modules/knowledge-base/models/article.model.js";
import AIConversation from "../modules/ai/models/ai-conversation.model.js";

describe("Phase 14 — AI Onboarding Assistant Test Suite", () => {
  let app: FastifyInstance;
  let testOrg: any;
  let employeeUser: any;
  let employeeToken: string;
  let testArticle: any;
  let createdConversationId: string;
  let assistantMessageId: string;

  let otherOrg: any;
  let otherAdmin: any;
  let otherAdminToken: string;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();
    const ts = Date.now();

    await User.deleteMany({ "auth.email": { $regex: "^phase14-" } });

    // 1. Create Tenant Organization
    testOrg = await Organization.create({
      name: "Phase 14 Test Org",
      slug: `phase14-org-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    // 2. Create Employee User
    employeeUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `phase14-employee-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Phase14",
        lastName: "Learner",
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

    // 3. Create Tenant Knowledge Base Article for RAG
    testArticle = await Article.create({
      organizationId: testOrg._id,
      title: "Company Security and Data Policy",
      slug: `security-policy-${ts}`,
      summary: "Official security policies for onboarding new team members.",
      content: {
        blocks: [
          {
            _id: new mongoose.Types.ObjectId(),
            type: "text",
            content: "All employees must complete security awareness training within 14 days of hiring.",
            order: 0,
          },
        ],
      },
      publishing: {
        status: "published",
        publishedAt: new Date(),
        version: 1,
      },
      searchKeywords: ["security", "policy", "company"],
      createdBy: employeeUser._id,
      isDeleted: false,
    });

    // 4. Create Secondary Tenant
    otherOrg = await Organization.create({
      name: "Phase 14 Other Org",
      slug: `phase14-other-${ts}`,
      createdBy: dummyId,
      isDeleted: false,
    });

    otherAdmin = await User.create({
      organizationId: otherOrg._id,
      auth: {
        email: `other14-admin-${ts}@test.com`,
        passwordHash: "hashedpassword123",
      },
      profile: {
        firstName: "Other",
        lastName: "Admin",
      },
      permissions: {
        role: "admin",
      },
    });

    otherAdminToken = app.jwt.sign({
      userId: otherAdmin._id.toString(),
      organizationId: otherOrg._id.toString(),
      role: "admin",
    });
  });

  afterAll(async () => {
    if (testOrg) {
      await AIConversation.deleteMany({ organizationId: testOrg._id });
      await Article.deleteMany({ organizationId: testOrg._id });
      await User.deleteMany({ organizationId: testOrg._id });
      await Organization.deleteOne({ _id: testOrg._id });
    }
    if (otherOrg) {
      await User.deleteMany({ organizationId: otherOrg._id });
      await Organization.deleteOne({ _id: otherOrg._id });
    }
    await app.close();
  });

  describe("1. Conversational Chat & Knowledge RAG Synthesis (AI-001, AI-002, AI-003)", () => {
    it("should process user prompt & return AI response with citations via POST /api/v1/ai/chat", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ai/chat",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          message: "What is the Company Security policy?",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.messages.length).toBe(2);

      const assistantMsg = json.data.messages.find((m: any) => m.sender === "assistant");
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg.citations.length).toBeGreaterThanOrEqual(1);
      expect(assistantMsg.citations[0].title).toBe("Company Security and Data Policy");
      expect(assistantMsg.actionSuggestions.length).toBeGreaterThanOrEqual(1);

      createdConversationId = json.data._id;
      assistantMessageId = assistantMsg._id;
    });
  });

  describe("2. Conversation History & Feedback Logging (AI-005)", () => {
    it("should list user conversation threads via GET /api/v1/ai/conversations", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ai/conversations",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.length).toBe(1);
    });

    it("should fetch conversation thread details via GET /api/v1/ai/conversations/:id", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/ai/conversations/${createdConversationId}`,
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data._id).toBe(createdConversationId);
    });

    it("should log response feedback rating via POST /api/v1/ai/feedback", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/v1/ai/feedback",
        headers: {
          authorization: `Bearer ${employeeToken}`,
        },
        payload: {
          conversationId: createdConversationId,
          messageId: assistantMessageId,
          rating: "up",
          comment: "Very accurate citation!",
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.feedback.length).toBe(1);
      expect(json.data.feedback[0].rating).toBe("up");
    });
  });

  describe("3. Multi-Tenant Boundary Isolation", () => {
    it("should isolate Tenant B AI conversation history from Tenant A data", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/ai/conversations",
        headers: {
          authorization: `Bearer ${otherAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.length).toBe(0);
    });
  });
});
