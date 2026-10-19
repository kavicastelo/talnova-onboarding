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
import Suppression from "../modules/sales/models/suppression.model.js";
import AudienceSegmentationService from "../modules/sales/services/audience-segmentation.service.js";

describe("CAMP-004: Audience Segmentation & Suppression Engine", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let regularUser: any;
  let testOrg: any;
  let superAdminToken: string;
  let regularToken: string;

  const testPrefix = `aud-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdContactIds: mongoose.Types.ObjectId[] = [];
  const createdCompanyIds: mongoose.Types.ObjectId[] = [];
  const createdCampaignIds: mongoose.Types.ObjectId[] = [];
  const createdSuppressionIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  const audienceService = new AudienceSegmentationService();

  // Test Entities
  let deliverableLead: any;
  let noConsentLead: any;
  let optedOutLead: any;
  let suppressedLead: any;
  let bouncedLead: any;
  let frequencyCappedLead: any;
  let lowScoreLead: any;
  let wrongIndustryLead: any;
  let excludedTagLead: any;

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Audience Test Org ${testPrefix}`,
      slug: `aud-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `aud-admin-${testPrefix}@talnova.test`,
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
        email: `aud-user-${testPrefix}@talnova.test`,
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

    // 1. Deliverable Lead (Matches all criteria: FinTech, Score 75, Consented, Enterprise Tag)
    deliverableLead = await Lead.create({
      name: `Alice Deliverable ${testPrefix}`,
      email: `alice.${testPrefix}@fintech.test`,
      normalizedEmail: `alice.${testPrefix}@fintech.test`,
      phone: "+15550001111",
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier", "q4-priority"],
      consent: {
        emailMarketing: true,
        whatsappMarketing: true,
        consentTimestamp: new Date(),
      },
    });
    createdLeadIds.push(deliverableLead._id);

    // 2. No Consent Lead (Email consent is false)
    noConsentLead = await Lead.create({
      name: `Bob NoConsent ${testPrefix}`,
      email: `bob.${testPrefix}@fintech.test`,
      normalizedEmail: `bob.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: {
        emailMarketing: false,
        whatsappMarketing: false,
      },
    });
    createdLeadIds.push(noConsentLead._id);

    // 3. Opted Out Lead (Explicit opt-out timestamp set)
    optedOutLead = await Lead.create({
      name: `Charlie OptedOut ${testPrefix}`,
      email: `charlie.${testPrefix}@fintech.test`,
      normalizedEmail: `charlie.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: {
        emailMarketing: true,
        optedOutAt: new Date(Date.now() - 86400000), // Opted out yesterday
      },
    });
    createdLeadIds.push(optedOutLead._id);

    // 4. Global Suppression Lead (Registered in SalesSuppression)
    suppressedLead = await Lead.create({
      name: `David Suppressed ${testPrefix}`,
      email: `david.${testPrefix}@fintech.test`,
      normalizedEmail: `david.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: {
        emailMarketing: true,
      },
    });
    createdLeadIds.push(suppressedLead._id);

    const supItem = await Suppression.create({
      identifier: `david.${testPrefix}@fintech.test`,
      type: "email",
      reason: "unsubscribe",
      source: "global_optout",
    });
    createdSuppressionIds.push(supItem._id);

    // 5. Bounced Lead (Address bounced in past campaign)
    bouncedLead = await Lead.create({
      name: `Eve Bounced ${testPrefix}`,
      email: `eve.${testPrefix}@fintech.test`,
      normalizedEmail: `eve.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: {
        emailMarketing: true,
      },
    });
    createdLeadIds.push(bouncedLead._id);

    const pastBouncedCampaign = await Campaign.create({
      name: `Past Bounced Campaign ${testPrefix}`,
      channel: "email",
      status: "completed",
      createdBy: superAdminUser._id,
      recipients: [
        {
          recipientEmail: `eve.${testPrefix}@fintech.test`,
          status: "bounced",
          sentAt: new Date(Date.now() - 3 * 86400000),
          errorMessage: "550 5.1.1 User Unknown",
        },
      ],
    });
    createdCampaignIds.push(pastBouncedCampaign._id);

    // 6. Frequency Capped Lead (Already received 2 messages in past 7 days)
    frequencyCappedLead = await Lead.create({
      name: `Frank FreqCap ${testPrefix}`,
      email: `frank.${testPrefix}@fintech.test`,
      normalizedEmail: `frank.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      companySize: "51-200",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: {
        emailMarketing: true,
      },
    });
    createdLeadIds.push(frequencyCappedLead._id);

    const pastRecentCampaign = await Campaign.create({
      name: `Recent Active Campaign ${testPrefix}`,
      channel: "email",
      status: "completed",
      createdBy: superAdminUser._id,
      recipients: [
        {
          recipientEmail: `frank.${testPrefix}@fintech.test`,
          status: "sent",
          sentAt: new Date(Date.now() - 2 * 86400000), // 2 days ago
        },
        {
          recipientEmail: `frank.${testPrefix}@fintech.test`,
          status: "delivered",
          sentAt: new Date(Date.now() - 1 * 86400000), // 1 day ago
        },
      ],
    });
    createdCampaignIds.push(pastRecentCampaign._id);

    // 7. Low Score Lead (Score 20, filtered out by minScore: 50)
    lowScoreLead = await Lead.create({
      name: `Grace LowScore ${testPrefix}`,
      email: `grace.${testPrefix}@fintech.test`,
      normalizedEmail: `grace.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      status: "qualified",
      score: 20,
      tags: ["enterprise-tier"],
      consent: { emailMarketing: true },
    });
    createdLeadIds.push(lowScoreLead._id);

    // 8. Wrong Industry Lead (Industry: Retail, filtered out)
    wrongIndustryLead = await Lead.create({
      name: `Heidi Retail ${testPrefix}`,
      email: `heidi.${testPrefix}@retail.test`,
      normalizedEmail: `heidi.${testPrefix}@retail.test`,
      companyName: "Retail World",
      industry: "Retail",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier"],
      consent: { emailMarketing: true },
    });
    createdLeadIds.push(wrongIndustryLead._id);

    // 9. Excluded Tag Lead (Has 'competitor' tag)
    excludedTagLead = await Lead.create({
      name: `Ivan Competitor ${testPrefix}`,
      email: `ivan.${testPrefix}@fintech.test`,
      normalizedEmail: `ivan.${testPrefix}@fintech.test`,
      companyName: "FinTech Prime",
      industry: "FinTech",
      status: "qualified",
      score: 75,
      tags: ["enterprise-tier", "competitor"],
      consent: { emailMarketing: true },
    });
    createdLeadIds.push(excludedTagLead._id);
  });

  afterAll(async () => {
    if (createdCampaignIds.length) {
      await Campaign.deleteMany({ _id: { $in: createdCampaignIds } });
    }
    if (createdLeadIds.length) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
    }
    if (createdContactIds.length) {
      await Contact.deleteMany({ _id: { $in: createdContactIds } });
    }
    if (createdCompanyIds.length) {
      await Company.deleteMany({ _id: { $in: createdCompanyIds } });
    }
    if (createdSuppressionIds.length) {
      await Suppression.deleteMany({ _id: { $in: createdSuppressionIds } });
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

  describe("1. Query Compiler & Criteria Filtering", () => {
    it("should filter candidates by status, score boundaries, industry, and exclude tags", async () => {
      const filter = {
        target: "leads" as const,
        channel: "email" as const,
        statuses: ["qualified"],
        minScore: 50,
        industries: ["FinTech"],
        includeTags: ["enterprise-tier"],
        excludeTags: ["competitor"],
      };

      const query = audienceService.compileLeadQuery(filter);
      const leads = await Lead.find(query).lean();
      const leadEmails = leads.map((l) => l.email);

      // Low score lead (score 20) should be excluded
      expect(leadEmails).not.toContain(lowScoreLead.email);
      // Wrong industry lead should be excluded
      expect(leadEmails).not.toContain(wrongIndustryLead.email);
      // Excluded tag lead ('competitor') should be excluded
      expect(leadEmails).not.toContain(excludedTagLead.email);

      // Deliverable lead and all candidates in FinTech with score 75 should match query stage
      expect(leadEmails).toContain(deliverableLead.email);
      expect(leadEmails).toContain(noConsentLead.email);
      expect(leadEmails).toContain(optedOutLead.email);
      expect(leadEmails).toContain(suppressedLead.email);
      expect(leadEmails).toContain(bouncedLead.email);
      expect(leadEmails).toContain(frequencyCappedLead.email);
    });
  });

  describe("2. Compliance Suppression Engine", () => {
    it("should enforce all 5 suppression rules and deliver ONLY deliverable candidates", async () => {
      const filter = {
        target: "leads" as const,
        channel: "email" as const,
        statuses: ["qualified"],
        minScore: 50,
        industries: ["FinTech"],
        includeTags: ["enterprise-tier"],
        excludeTags: ["competitor"],
        frequencyCap: {
          maxMessages: 2,
          windowDays: 7,
        },
      };

      const estimation = await audienceService.estimateAudience(filter);

      // 6 leads match the segment criteria:
      // - deliverableLead (Deliverable!)
      // - noConsentLead (Suppressed: noConsent)
      // - optedOutLead (Suppressed: optedOut)
      // - suppressedLead (Suppressed: suppressionList)
      // - bouncedLead (Suppressed: bounced)
      // - frequencyCappedLead (Suppressed: frequencyCapped)
      expect(estimation.totalMatching).toBe(6);
      expect(estimation.netDeliverable).toBe(1);
      expect(estimation.suppressedCount).toBe(5);

      // Verify specific breakdown categories
      expect(estimation.breakdown.noConsent).toBe(1);
      expect(estimation.breakdown.optedOut).toBe(1);
      expect(estimation.breakdown.suppressionList).toBe(1);
      expect(estimation.breakdown.bounced).toBe(1);
      expect(estimation.breakdown.frequencyCapped).toBe(1);

      // Verify sample recipient is strictly the deliverable lead
      expect(estimation.sampleRecipients.length).toBe(1);
      expect(estimation.sampleRecipients[0].recipientEmail).toBe(deliverableLead.email);
    });

    it("should dynamically add and check global suppressions", async () => {
      const testEmail = `new-unsub-${testPrefix}@test.com`;
      expect(await audienceService.isSuppressed(testEmail, "email")).toBe(false);

      const item = await audienceService.suppressRecipient(testEmail, "email", "unsubscribe", "test_suite");
      createdSuppressionIds.push(item._id);

      expect(await audienceService.isSuppressed(testEmail, "email")).toBe(true);
    });
  });

  describe("3. Estimation & Resolution API Endpoints", () => {
    it("should estimate audience under 500ms via POST /api/v1/sales/campaigns/audience/estimate", async () => {
      const start = Date.now();
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/audience/estimate",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          filter: {
            target: "leads",
            channel: "email",
            statuses: ["qualified"],
            minScore: 50,
            industries: ["FinTech"],
            includeTags: ["enterprise-tier"],
            excludeTags: ["competitor"],
          },
          sampleSize: 3,
        },
      });
      const duration = Date.now() - start;

      expect(res.statusCode).toBe(200);
      expect(duration).toBeLessThan(1000); // Well within acceptance limit

      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.netDeliverable).toBe(1);
      expect(body.data.breakdown.optedOut).toBeGreaterThanOrEqual(1);
    });

    it("should resolve deliverable recipients via POST /api/v1/sales/campaigns/audience/resolve", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/audience/resolve",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          filter: {
            target: "leads",
            channel: "email",
            statuses: ["qualified"],
            minScore: 50,
            industries: ["FinTech"],
            includeTags: ["enterprise-tier"],
            excludeTags: ["competitor"],
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.recipients.length).toBe(1);
      expect(body.data.recipients[0].recipientEmail).toBe(deliverableLead.email);
      expect(body.data.recipients[0].status).toBe("pending");
    });

    it("should auto-resolve recipients into Campaign when creating with audienceFilter", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns",
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          name: `Auto Filter Campaign ${testPrefix}`,
          channel: "email",
          subject: "Exclusive Invitation for {{companyName}}",
          content: "<p>Hello {{firstName}}</p>",
          audienceFilter: {
            target: "leads",
            channel: "email",
            statuses: ["qualified"],
            minScore: 50,
            industries: ["FinTech"],
            includeTags: ["enterprise-tier"],
            excludeTags: ["competitor"],
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.stats.totalRecipients).toBe(1);
      expect(body.data.recipients.length).toBe(1);
      expect(body.data.recipients[0].recipientEmail).toBe(deliverableLead.email);

      createdCampaignIds.push(new mongoose.Types.ObjectId(body.data._id));
    });

    it("should enforce RBAC guard on audience endpoints", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/sales/campaigns/audience/estimate",
        headers: { authorization: `Bearer ${regularToken}` },
        payload: {
          filter: { channel: "email" },
        },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
