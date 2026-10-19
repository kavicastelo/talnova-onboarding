import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import Contact from "../modules/sales/models/contact.model.js";
import Company from "../modules/sales/models/company.model.js";
import Campaign from "../modules/sales/models/campaign.model.js";
import CampaignTemplate from "../modules/sales/models/campaign-template.model.js";
import CampaignService from "../modules/sales/services/campaign.service.js";

describe("CAMP-003: Campaign CRUD & Template Management API", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;
  let testCompany: any;
  let testContact: any;
  let testLead: any;

  const testPrefix = `camp-test-${Date.now()}`;
  const createdCampaignIds: mongoose.Types.ObjectId[] = [];
  const createdTemplateIds: mongoose.Types.ObjectId[] = [];
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  const campaignService = new CampaignService();

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Campaign Test Org ${testPrefix}`,
      slug: `camp-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `camp-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Super",
        lastName: "Admin",
      },
      roles: ["super_admin"],
      systemRole: "super_admin",
      status: "Active",
    });
    createdUserIds.push(superAdminUser._id);

    regularUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `camp-user-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Sales",
        lastName: "Rep",
      },
      roles: ["employee"],
      systemRole: "employee",
      status: "Active",
    });
    createdUserIds.push(regularUser._id);

    superAdminToken = app.jwt.sign({
      id: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      roles: ["super_admin"],
      organizationId: testOrg._id.toString(),
    });

    regularToken = app.jwt.sign({
      id: regularUser._id.toString(),
      email: regularUser.auth.email,
      roles: ["employee"],
      organizationId: testOrg._id.toString(),
    });

    testCompany = await Company.create({
      name: `Acme Corp ${testPrefix}`,
      domain: `acme-${testPrefix}.test`,
      industry: "Technology",
      status: "customer",
      tags: ["enterprise"],
    });
    createdCompanyIds.push(testCompany._id);

    testContact = await Contact.create({
      companyId: testCompany._id,
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: `jane-${testPrefix}@acme.test`,
      normalizedEmail: `jane-${testPrefix}@acme.test`,
      phone: "+15551234567",
      jobTitle: "VP of Engineering",
      role: "buyer",
      consent: {
        emailMarketing: true,
        whatsappMarketing: true,
      },
    });
    createdContactIds.push(testContact._id);

    testLead = await Lead.create({
      name: "John Smith",
      email: `john-${testPrefix}@leadcorp.test`,
      normalizedEmail: `john-${testPrefix}@leadcorp.test`,
      phone: "+15559876543",
      companyName: "LeadCorp Inc",
      jobTitle: "Director of Product",
      status: "new",
      leadScore: 50,
      consent: {
        emailMarketing: true,
        whatsappMarketing: false,
      },
    });
    createdLeadIds.push(testLead._id);
  });

  afterAll(async () => {
    if (createdCampaignIds.length) {
      await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    }
    if (createdTemplateIds.length) {
      await CampaignTemplate.deleteMany({ _id: { $in: createdTemplateIds } });
    }
    if (createdContactIds.length) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdLeadIds.length) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdUserIds.length) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    if (createdOrgIds.length) {
      await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    }
    await app.close();
    await disconnectDatabase();
  });

  describe("1. Interpolation Engine Unit Tests", () => {
    it("should interpolate single and multiple variables correctly", () => {
      const template = "Hello {{firstName}}, welcome to {{productName}}!";
      const variables = { firstName: "Alice", productName: "Talnova" };
      const result = campaignService.interpolateText(template, variables);

      expect(result.text).toBe("Hello Alice, welcome to Talnova!");
      expect(result.missingVariables).toEqual([]);
    });

    it("should use variable-level fallback when key is missing", () => {
      const template = "Hi {{firstName|Valued Customer}}, your company {{companyName|your organization}} is invited!";
      const variables = { companyName: "Acme" };
      const result = campaignService.interpolateText(template, variables);

      expect(result.text).toBe("Hi Valued Customer, your company Acme is invited!");
      expect(result.missingVariables).toEqual([]);
    });

    it("should gracefully handle missing variables with default fallback", () => {
      const template = "Dear {{firstName}}, check out {{ctaUrl}} or {{missingThing}}.";
      const variables = { firstName: "Bob" };
      const result = campaignService.interpolateText(template, variables, "[N/A]");

      expect(result.text).toBe("Dear Bob, check out [N/A] or [N/A].");
      expect(result.missingVariables).toEqual(["ctaUrl", "missingThing"]);
    });

    it("should support nested object notation", () => {
      const template = "Sending to {{contact.email}} at {{company.name}}";
      const variables = {
        contact: { email: "test@example.com" },
        company: { name: "Apex Global" },
      };
      const result = campaignService.interpolateText(template, variables);

      expect(result.text).toBe("Sending to test@example.com at Apex Global");
      expect(result.missingVariables).toEqual([]);
    });

    it("should build merge variables from a live Lead record", async () => {
      const vars = await campaignService.buildMergeVariables({
        leadId: testLead._id.toString(),
      });

      expect(vars.firstName).toBe("John");
      expect(vars.lastName).toBe("Smith");
      expect(vars.fullName).toBe("John Smith");
      expect(vars.companyName).toBe("LeadCorp Inc");
      expect(vars.email).toBe(testLead.email);
      expect(vars.productName).toBe("Talnova");
    });

    it("should build merge variables from a live Contact & Company record", async () => {
      const vars = await campaignService.buildMergeVariables({
        contactId: testContact._id.toString(),
      });

      expect(vars.firstName).toBe("Jane");
      expect(vars.lastName).toBe("Doe");
      expect(vars.fullName).toBe("Jane Doe");
      expect(vars.email).toBe(testContact.email);
      expect(vars.companyName).toBe(testCompany.name);
    });
  });

  describe("2. Communication Templates API", () => {
    let emailTemplateId: string;
    let whatsappTemplateId: string;

    it("should enforce validation constraints on Email templates", async () => {
      // Missing subject
      const res1 = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Invalid Email Template",
          channel: "email",
          htmlContent: "<p>Hello</p>",
        },
      });
      expect(res1.statusCode).toBe(400);

      // Missing body (no html and no plainText)
      const res2 = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Invalid Email Template",
          channel: "email",
          subject: "Test Subject",
        },
      });
      expect(res2.statusCode).toBe(400);
    });

    it("should enforce validation constraints on WhatsApp templates", async () => {
      // Missing whatsappTemplateName
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Invalid WhatsApp Template",
          channel: "whatsapp",
          whatsappLanguageCode: "en_US",
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it("should successfully create valid Email and WhatsApp templates", async () => {
      const emailRes = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Q4 Product Launch Email",
          channel: "email",
          subject: "Exclusive Preview: {{productName}} for {{companyName}}",
          previewText: "Hi {{firstName}}, check out what's new!",
          htmlContent: "<h1>Hi {{firstName|there}},</h1><p>We launched new features at {{companyName}}.</p>",
          plainTextContent: "Hi {{firstName|there}},\nWe launched new features at {{companyName}}.",
          tags: ["q4", "product-launch"],
        },
      });

      expect(emailRes.statusCode).toBe(201);
      const emailBody = JSON.parse(emailRes.body);
      expect(emailBody.success).toBe(true);
      expect(emailBody.data.name).toBe("Q4 Product Launch Email");
      emailTemplateId = emailBody.data._id;
      createdTemplateIds.push(new mongoose.Types.ObjectId(emailTemplateId));

      const waRes = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Welcome Onboarding WhatsApp",
          channel: "whatsapp",
          whatsappTemplateName: "welcome_onboarding_v1",
          whatsappLanguageCode: "en",
          whatsappCategory: "UTILITY",
          whatsappParameters: ["firstName", "companyName"],
          tags: ["whatsapp", "onboarding"],
        },
      });

      expect(waRes.statusCode).toBe(201);
      const waBody = JSON.parse(waRes.body);
      expect(waBody.success).toBe(true);
      expect(waBody.data.whatsappTemplateName).toBe("welcome_onboarding_v1");
      whatsappTemplateId = waBody.data._id;
      createdTemplateIds.push(new mongoose.Types.ObjectId(whatsappTemplateId));
    });

    it("should query and list templates with filtering and pagination", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/sales/campaigns/templates?channel=email",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.every((t: any) => t.channel === "email")).toBe(true);
    });

    it("should preview template interpolation with live lead and sample variables", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/templates/preview",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          templateId: emailTemplateId,
          leadId: testLead._id.toString(),
          sampleVariables: {
            customField: "Beta Tester",
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.subject).toBe(`Exclusive Preview: Talnova for LeadCorp Inc`);
      expect(body.data.htmlContent).toContain("Hi John,");
      expect(body.data.htmlContent).toContain("new features at LeadCorp Inc.");
      expect(body.data.resolvedVariables.firstName).toBe("John");
      expect(body.data.resolvedVariables.companyName).toBe("LeadCorp Inc");
    });

    it("should update a template", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/templates/${emailTemplateId}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          subject: "Updated Subject for {{firstName}}",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.subject).toBe("Updated Subject for {{firstName}}");
    });
  });

  describe("3. Campaigns API & State Machine", () => {
    let createdEmailCampaignId: string;
    let createdWaCampaignId: string;

    it("should create an Email campaign linked to an existing template", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Global Q4 Outbound",
          description: "Targeting enterprise prospects",
          channel: "email",
          templateId: createdTemplateIds[0].toString(),
          tags: ["q4", "outbound"],
          recipients: [
            {
              leadId: testLead._id.toString(),
              recipientEmail: testLead.email,
              recipientName: testLead.name,
            },
            {
              contactId: testContact._id.toString(),
              recipientEmail: testContact.email,
              recipientName: testContact.fullName,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Global Q4 Outbound");
      expect(body.data.status).toBe("draft");
      expect(body.data.stats.totalRecipients).toBe(2);
      expect(body.data.recipients.length).toBe(2);

      createdEmailCampaignId = body.data._id;
      createdCampaignIds.push(new mongoose.Types.ObjectId(createdEmailCampaignId));
    });

    it("should reject WhatsApp campaign if channel does not match template channel", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Mismatched Channel Campaign",
          channel: "whatsapp",
          templateId: createdTemplateIds[0].toString(), // email template
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("CHANNEL_MISMATCH");
    });

    it("should create a standalone WhatsApp campaign", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Customer Reactivation WhatsApp",
          channel: "whatsapp",
          whatsappTemplateName: "customer_reactivation_v2",
          whatsappLanguageCode: "en",
          tags: ["reactivation"],
          recipients: [
            {
              contactId: testContact._id.toString(),
              recipientPhone: testContact.phone,
              recipientName: testContact.fullName,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("draft");
      expect(body.data.stats.totalRecipients).toBe(1);

      createdWaCampaignId = body.data._id;
      createdCampaignIds.push(new mongoose.Types.ObjectId(createdWaCampaignId));
    });

    it("should add recipients to an existing campaign", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/recipients`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          recipients: [
            {
              recipientEmail: "extra.partner@example.com",
              recipientName: "Extra Partner",
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.totalRecipients).toBe(3);
    });

    it("should validate and enforce state machine transitions", async () => {
      // 1. draft -> scheduled
      const schedRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "scheduled" },
      });
      expect(schedRes.statusCode).toBe(200);
      expect(JSON.parse(schedRes.body).data.status).toBe("scheduled");

      // 2. scheduled -> sending
      const sendRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "sending" },
      });
      expect(sendRes.statusCode).toBe(200);
      const sendBody = JSON.parse(sendRes.body);
      expect(sendBody.data.status).toBe("sending");
      expect(sendBody.data.startedAt).toBeDefined();

      // 3. Invalid transition: sending -> draft should be rejected
      const invalidRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "draft" },
      });
      expect(invalidRes.statusCode).toBe(400);
      expect(JSON.parse(invalidRes.body).code).toBe("INVALID_STATE_TRANSITION");

      // 4. sending -> paused
      const pauseRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "paused" },
      });
      expect(pauseRes.statusCode).toBe(200);
      expect(JSON.parse(pauseRes.body).data.status).toBe("paused");

      // 5. paused -> sending -> completed
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "sending" },
      });

      const compRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "completed" },
      });
      expect(compRes.statusCode).toBe(200);
      const compBody = JSON.parse(compRes.body);
      expect(compBody.data.status).toBe("completed");
      expect(compBody.data.completedAt).toBeDefined();

      // 6. completed is terminal; transitioning to any other state should fail
      const terminalRes = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "draft" },
      });
      expect(terminalRes.statusCode).toBe(400);
    });

    it("should prevent deleting a campaign in sending status", async () => {
      // Put wa campaign into sending
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdWaCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "scheduled" },
      });
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdWaCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "sending" },
      });

      const delRes = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/campaigns/${createdWaCampaignId}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(delRes.statusCode).toBe(400);
      expect(JSON.parse(delRes.body).code).toBe("INVALID_STATE");

      // Now cancel it to allow deletion
      await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/campaigns/${createdWaCampaignId}/status`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: { status: "cancelled" },
      });
    });

    it("should clone an existing campaign into a fresh draft with reset stats and pending recipients", async () => {
      const cloneRes = await app.inject({
        method: "POST",
        url: `/api/v1/sales/campaigns/${createdEmailCampaignId}/clone`,
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: "Cloned Global Q4 Outbound",
          includeRecipients: true,
        },
      });

      expect(cloneRes.statusCode).toBe(201);
      const body = JSON.parse(cloneRes.body);
      expect(body.success).toBe(true);
      expect(body.data.name).toBe("Cloned Global Q4 Outbound");
      expect(body.data.status).toBe("draft");
      expect(body.data.stats.totalRecipients).toBe(3);
      expect(body.data.stats.sentCount).toBe(0);
      expect(body.data.recipients.every((r: any) => r.status === "pending")).toBe(true);

      createdCampaignIds.push(new mongoose.Types.ObjectId(body.data._id));
    });

    it("should list campaigns with search, status filters, and aggregate counters", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.pagination.total).toBeGreaterThanOrEqual(2);
      expect(body.counters).toBeDefined();
      expect(body.counters.all).toBeGreaterThanOrEqual(2);
    });

    it("should prevent deleting a template currently referenced by active campaigns", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/sales/campaigns/templates/${createdTemplateIds[0].toString()}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe("TEMPLATE_IN_USE");
    });

    it("should enforce super_admin RBAC for campaign and template routes", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${regularToken}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
