import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { FastifyInstance } from "fastify";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../database/connection.js";
import User from "../modules/auth/models/user.model.js";
import Organization from "../modules/organizations/models/organization.model.js";
import Lead from "../modules/sales/models/lead.model.js";
import CommThread from "../modules/sales/models/comm-thread.model.js";
import AuditLog from "../modules/audit-logs/models/audit-log.model.js";
import SystemJob from "../infrastructure/queue/system-job.model.js";
import { LeadScoringService, determinePriorityFromScore, validateLifecycleTransition } from "../modules/sales/services/lead-scoring.service.js";

describe("LEAD-003: Rule-Based Lead Scoring & Lifecycle Transitions", () => {
  let app: FastifyInstance;
  let superAdminUser: any;
  let testOrg: any;
  let superAdminToken: string;
  const scoringService = new LeadScoringService();

  const testPrefix = `score-test-${Date.now()}`;
  const createdLeadIds: mongoose.Types.ObjectId[] = [];
  const createdThreadIds: mongoose.Types.ObjectId[] = [];
  const createdUserIds: mongoose.Types.ObjectId[] = [];
  const createdOrgIds: mongoose.Types.ObjectId[] = [];

  beforeAll(async () => {
    app = await buildApp();
    await connectDatabase(app.log);
    await app.ready();

    const dummyId = new mongoose.Types.ObjectId();

    testOrg = await Organization.create({
      name: `Scoring Test Org ${testPrefix}`,
      slug: `scoring-org-${testPrefix}`,
      plan: "Enterprise",
      status: "Active",
      createdBy: dummyId,
      isDeleted: false,
    });
    createdOrgIds.push(testOrg._id);

    superAdminUser = await User.create({
      organizationId: testOrg._id,
      auth: {
        email: `scoring-admin-${testPrefix}@talnova.test`,
        passwordHash: "dummy_hash",
      },
      profile: {
        firstName: "Scoring",
        lastName: "Admin",
        fullName: "Scoring Admin",
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
      userId: superAdminUser._id.toString(),
      email: superAdminUser.auth.email,
      role: superAdminUser.permissions.role,
      organizationId: testOrg._id.toString(),
      tokenVersion: 0,
    });
  });

  afterAll(async () => {
    if (createdLeadIds.length > 0) {
      await Lead.deleteMany({ _id: { $in: createdLeadIds } });
      await AuditLog.deleteMany({ resourceId: { $in: createdLeadIds } });
      await SystemJob.deleteMany({ "data.targetId": { $in: createdLeadIds.map((id) => id.toString()) } });
    }
    if (createdThreadIds.length > 0) {
      await CommThread.deleteMany({ _id: { $in: createdThreadIds } });
    }
    await Lead.deleteMany({ companyName: { $regex: testPrefix } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    await Organization.deleteMany({ _id: { $in: createdOrgIds } });
    await disconnectDatabase(app.log);
    await app.close();
  });

  describe("Unit Logic: Priority Calculation & State Transition Guards", () => {
    it("should correctly compute priority based on score thresholds", () => {
      expect(determinePriorityFromScore(0)).toBe("low");
      expect(determinePriorityFromScore(24)).toBe("low");
      expect(determinePriorityFromScore(25)).toBe("normal");
      expect(determinePriorityFromScore(49)).toBe("normal");
      expect(determinePriorityFromScore(50)).toBe("high");
      expect(determinePriorityFromScore(79)).toBe("high");
      expect(determinePriorityFromScore(80)).toBe("urgent");
      expect(determinePriorityFromScore(100)).toBe("urgent");
    });

    it("should allow valid lifecycle transitions", () => {
      expect(() => validateLifecycleTransition("new", "contacted")).not.toThrow();
      expect(() => validateLifecycleTransition("contacted", "engaged")).not.toThrow();
      expect(() => validateLifecycleTransition("engaged", "qualified")).not.toThrow();
      expect(() => validateLifecycleTransition("qualified", "opportunity")).not.toThrow();
      expect(() => validateLifecycleTransition("opportunity", "converted")).not.toThrow();
      expect(() => validateLifecycleTransition("new", "new")).not.toThrow(); // no-op is allowed
    });

    it("should reject illegal lifecycle transitions and enforce terminal states", () => {
      // Cannot skip directly from new to converted
      expect(() => validateLifecycleTransition("new", "converted")).toThrow("Cannot transition lead status from 'new' to 'converted'");

      // Converted is terminal - no transitions allowed
      expect(() => validateLifecycleTransition("converted", "new")).toThrow("Cannot transition lead status from 'converted' to 'new'");
      expect(() => validateLifecycleTransition("converted", "contacted")).toThrow("Cannot transition lead status from 'converted' to 'contacted'");

      // Duplicate is terminal
      expect(() => validateLifecycleTransition("duplicate", "new")).toThrow("Cannot transition lead status from 'duplicate' to 'new'");

      // Disqualified can only transition to nurturing or contacted
      expect(() => validateLifecycleTransition("disqualified", "qualified")).toThrow("Cannot transition lead status from 'disqualified' to 'qualified'");
      expect(() => validateLifecycleTransition("disqualified", "contacted")).not.toThrow();
      expect(() => validateLifecycleTransition("disqualified", "nurturing")).not.toThrow();
    });
  });

  describe("Rule-Based Lead Scoring Engine", () => {
    it("should calculate score from profile completeness, source, company size, and budget", async () => {
      const lead = await Lead.create({
        name: "Enterprise Prospect",
        email: `prospect-${testPrefix}@bigcorp.test`,
        normalizedEmail: `prospect-${testPrefix}@bigcorp.test`,
        phone: "+1-555-900-1111",
        normalizedPhone: "+15559001111",
        companyName: `BigCorp ${testPrefix}`,
        jobTitle: "Chief Technology Officer",
        industry: "Enterprise Software",
        companySize: "1000+",
        source: "product_demo",
        estimatedBudget: 120000,
        status: "new",
        score: 0,
        priority: "low",
      });
      createdLeadIds.push(lead._id);

      const scoredLead = await scoringService.recalculateLeadScore(lead._id.toString());

      // Expected Points breakdown:
      // Phone: +10
      // Title: +5
      // Industry: +5
      // Size provided: +5
      // Source product_demo: +25
      // Company size 1000+: +25
      // Budget >= 100,000: +20
      // Total: 95
      expect(scoredLead.score).toBe(95);
      expect(scoredLead.priority).toBe("urgent");
      expect(scoredLead.scoreBreakdown.length).toBeGreaterThanOrEqual(7);

      const rulesApplied = scoredLead.scoreBreakdown.map((b) => b.rule);
      expect(rulesApplied).toContain("PROFILE_PHONE_PROVIDED");
      expect(rulesApplied).toContain("PROFILE_TITLE_PROVIDED");
      expect(rulesApplied).toContain("PROFILE_INDUSTRY_PROVIDED");
      expect(rulesApplied).toContain("PROFILE_SIZE_PROVIDED");
      expect(rulesApplied).toContain("SOURCE_PRODUCT_DEMO");
      expect(rulesApplied).toContain("ENTERPRISE_COMPANY_SIZE");
      expect(rulesApplied).toContain("HIGH_ESTIMATED_BUDGET");
    });

    it("should incorporate communication events and notes into scoring", async () => {
      const lead = await Lead.create({
        name: "Active Prospect",
        email: `active-${testPrefix}@midsize.test`,
        normalizedEmail: `active-${testPrefix}@midsize.test`,
        companyName: `MidSize ${testPrefix}`,
        source: "website",
        status: "contacted",
        score: 0,
        priority: "low",
        notes: [
          { content: "First discovery call completed", createdAt: new Date() },
          { content: "Follow-up proposal requested", createdAt: new Date() },
        ],
      });
      createdLeadIds.push(lead._id);

      // Create communication thread with inbound messages
      const thread = await CommThread.create({
        leadId: lead._id,
        channel: "email",
        status: "open",
        subject: "Demo Discussion",
        messages: [
          {
            channel: "email",
            direction: "inbound",
            from: lead.email,
            to: ["sales@talnova.test"],
            body: "We reviewed the proposal and would like to proceed with 50 seats.",
            sentAt: new Date(),
          },
        ],
      });
      createdThreadIds.push(thread._id);

      const scoredLead = await scoringService.recalculateLeadScore(lead._id.toString());

      const rulesApplied = scoredLead.scoreBreakdown.map((b) => b.rule);
      expect(rulesApplied).toContain("SOURCE_WEBSITE"); // +5
      expect(rulesApplied).toContain("SALES_NOTES_LOGGED"); // 2 notes * 5 = +10
      expect(rulesApplied).toContain("INBOUND_COMM_ACTIVITY"); // 1 message * 10 = +10
      expect(scoredLead.score).toBe(25);
      expect(scoredLead.priority).toBe("normal");
    });

    it("should apply inactivity decay if no contact occurred in >= 14 days", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const lead = await Lead.create({
        name: "Dormant Prospect",
        email: `dormant-${testPrefix}@oldcorp.test`,
        normalizedEmail: `dormant-${testPrefix}@oldcorp.test`,
        companyName: `OldCorp ${testPrefix}`,
        source: "referral", // +20
        status: "new",
        score: 20,
        priority: "low",
        lastContactDate: thirtyDaysAgo,
        createdAt: thirtyDaysAgo,
      });
      createdLeadIds.push(lead._id);

      const scoredLead = await scoringService.recalculateLeadScore(lead._id.toString());

      // 30 days = 2 periods of 14 days -> -10 decay points
      // Referral: +20, Inactivity: -10 -> Net: 10
      const rulesApplied = scoredLead.scoreBreakdown.map((b) => b.rule);
      expect(rulesApplied).toContain("INACTIVITY_DECAY");
      expect(scoredLead.score).toBe(10);
      expect(scoredLead.priority).toBe("low");
    });

    it("should automatically enqueue qualification workflow job when score crosses 70", async () => {
      const lead = await Lead.create({
        name: "Qualifiable Lead",
        email: `qualifiable-${testPrefix}@threshold.test`,
        normalizedEmail: `qualifiable-${testPrefix}@threshold.test`,
        companyName: `Threshold Corp ${testPrefix}`,
        source: "product_demo", // +25
        companySize: "1000+", // +25
        estimatedBudget: 150000, // +20
        // Total = 70+
        status: "new",
        score: 0,
      });
      createdLeadIds.push(lead._id);

      await scoringService.recalculateLeadScore(lead._id.toString());

      // Polling check for persisted SystemJob
      let jobFound = false;
      for (let i = 0; i < 20; i++) {
        const job = await SystemJob.findOne({
          name: "sales:workflow:trigger",
          "data.targetId": lead._id.toString(),
        });
        if (job) {
          jobFound = true;
          expect(job.data.triggerType).toBe("lead_created");
          expect(job.data.actionPayload.priority).toBe("urgent");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(jobFound).toBe(true);
    });

    it("should record custom score events via recordScoreEvent and write audit log", async () => {
      const lead = await Lead.create({
        name: "Webinar Lead",
        email: `webinar-${testPrefix}@event.test`,
        normalizedEmail: `webinar-${testPrefix}@event.test`,
        companyName: `Webinar Corp ${testPrefix}`,
        source: "campaign",
        status: "new",
        score: 10,
        priority: "low",
      });
      createdLeadIds.push(lead._id);

      const updated = await scoringService.recordScoreEvent(
        lead._id.toString(),
        "ATTENDED_LIVE_WEBINAR",
        45,
        superAdminUser._id.toString()
      );

      expect(updated.score).toBe(55);
      expect(updated.priority).toBe("high");
      expect(updated.scoreBreakdown.some((b) => b.rule === "ATTENDED_LIVE_WEBINAR" && b.points === 45)).toBe(true);

      // Verify Audit Log
      let auditLogFound = false;
      for (let i = 0; i < 20; i++) {
        const auditLog = await AuditLog.findOne({
          resourceId: lead._id,
          eventType: "LEAD_SCORE_UPDATED",
        });
        if (auditLog) {
          auditLogFound = true;
          expect(auditLog.description).toContain("+45");
          expect(auditLog.metadata?.rule).toBe("ATTENDED_LIVE_WEBINAR");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(auditLogFound).toBe(true);
    });
  });

  describe("API Endpoints: Scoring & Lifecycle Transition Endpoints", () => {
    it("POST /api/v1/sales/leads/:id/recalculate-score should recalculate score and update document", async () => {
      const lead = await Lead.create({
        name: "Endpoint Test Lead",
        email: `endpoint-lead-${testPrefix}@test.com`,
        normalizedEmail: `endpoint-lead-${testPrefix}@test.com`,
        phone: "+1-555-888-9999",
        companyName: `Endpoint Corp ${testPrefix}`,
        jobTitle: "VP Sales",
        source: "referral", // +20
        companySize: "501-1000", // +20
        status: "new",
        score: 0,
      });
      createdLeadIds.push(lead._id);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/leads/${lead._id}/recalculate-score`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.score).toBeGreaterThan(0);
      expect(body.data.scoreBreakdown).toBeDefined();

      // Verify idempotency: calling it again returns identical score
      const secondResponse = await app.inject({
        method: "POST",
        url: `/api/v1/sales/leads/${lead._id}/recalculate-score`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
      });
      const secondBody = JSON.parse(secondResponse.body);
      expect(secondBody.data.score).toBe(body.data.score);
    });

    it("POST /api/v1/sales/leads/:id/score-event should append point delta", async () => {
      const lead = await Lead.create({
        name: "Score Event API Lead",
        email: `score-event-${testPrefix}@test.com`,
        normalizedEmail: `score-event-${testPrefix}@test.com`,
        companyName: `Delta Corp ${testPrefix}`,
        status: "new",
        score: 20,
        priority: "low",
      });
      createdLeadIds.push(lead._id);

      const response = await app.inject({
        method: "POST",
        url: `/api/v1/sales/leads/${lead._id}/score-event`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          rule: "PRICING_PAGE_VISITED",
          points: 15,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.score).toBe(35);
      expect(body.data.priority).toBe("normal");
    });

    it("PATCH /api/v1/sales/leads/:id/status should reject illegal state jumps", async () => {
      const lead = await Lead.create({
        name: "Lifecycle Lead",
        email: `lifecycle-${testPrefix}@test.com`,
        normalizedEmail: `lifecycle-${testPrefix}@test.com`,
        companyName: `Lifecycle Corp ${testPrefix}`,
        status: "new",
      });
      createdLeadIds.push(lead._id);

      // Illegal transition: new -> converted
      const illegalResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/leads/${lead._id}/status`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          status: "converted",
        },
      });

      expect(illegalResponse.statusCode).toBe(400);
      const illegalBody = JSON.parse(illegalResponse.body);
      expect(illegalBody.code).toBe("ILLEGAL_STATUS_TRANSITION");

      // Valid transition: new -> contacted
      const validResponse = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/leads/${lead._id}/status`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          status: "contacted",
          note: "Outreach email sent successfully",
        },
      });

      expect(validResponse.statusCode).toBe(200);
      const validBody = JSON.parse(validResponse.body);
      expect(validBody.data.status).toBe("contacted");
      expect(validBody.data.notes.length).toBe(1);
    });

    it("PATCH /api/v1/sales/leads/:id should reject illegal status update in general PATCH", async () => {
      const lead = await Lead.create({
        name: "General Patch Lead",
        email: `gen-patch-${testPrefix}@test.com`,
        normalizedEmail: `gen-patch-${testPrefix}@test.com`,
        companyName: `General Corp ${testPrefix}`,
        status: "converted",
      });
      createdLeadIds.push(lead._id);

      // Illegal: converted is terminal, cannot transition back to new
      const response = await app.inject({
        method: "PATCH",
        url: `/api/v1/sales/leads/${lead._id}`,
        headers: {
          authorization: `Bearer ${superAdminToken}`,
        },
        payload: {
          status: "new",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe("ILLEGAL_STATUS_TRANSITION");
    });
  });
});
