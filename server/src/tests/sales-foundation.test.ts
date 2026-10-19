import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import {
  Lead,
  Company,
  Contact,
  Pipeline,
  Deal,
  SalesTask,
  Campaign,
  CampaignTemplate,
  SalesIntegration,
  CommThread,
  AIInsight,
} from "../modules/sales/models/index.js";

describe("FOUND-001: Core Sales Mongoose Schemas & Database Models", () => {
  it("should instantiate a valid Lead model with required fields and defaults", () => {
    const lead = new Lead({
      name: "Jane Doe",
      email: "jane.doe@enterprise.com",
      normalizedEmail: "jane.doe@enterprise.com",
      companyName: "Acme Corp",
      industry: "Software",
      source: "website",
    });

    expect(lead.name).toBe("Jane Doe");
    expect(lead.status).toBe("new");
    expect(lead.score).toBe(0);
    expect(lead.priority).toBe("normal");
    expect(lead.currency).toBe("USD");
    expect(lead.consent.emailMarketing).toBe(false);
  });

  it("should instantiate a valid Company model with defaults", () => {
    const company = new Company({
      name: "Acme Corp",
      domain: "acme.com",
      industry: "Fintech",
    });

    expect(company.name).toBe("Acme Corp");
    expect(company.domain).toBe("acme.com");
    expect(company.tier).toBe("enterprise");
    expect(company.status).toBe("prospect");
    expect(company.annualRevenuePotential).toBe(0);
  });

  it("should instantiate a Contact model linked to a Company", () => {
    const companyId = new mongoose.Types.ObjectId();
    const contact = new Contact({
      companyId,
      firstName: "John",
      lastName: "Smith",
      fullName: "John Smith",
      email: "john.smith@acme.com",
      normalizedEmail: "john.smith@acme.com",
      role: "buyer",
      isPrimaryDecisionMaker: true,
    });

    expect(contact.companyId).toEqual(companyId);
    expect(contact.fullName).toBe("John Smith");
    expect(contact.role).toBe("buyer");
    expect(contact.isPrimaryDecisionMaker).toBe(true);
  });

  it("should instantiate a Pipeline model with ordered stages and probability constraints", () => {
    const pipeline = new Pipeline({
      name: "Standard Enterprise Sales",
      isDefault: true,
      stages: [
        { key: "qualification", name: "Qualification", probability: 0.1, order: 1 },
        { key: "demo_completed", name: "Demo Completed", probability: 0.5, order: 2 },
        { key: "closed_won", name: "Closed Won", probability: 1.0, order: 3 },
      ],
    });

    expect(pipeline.name).toBe("Standard Enterprise Sales");
    expect(pipeline.stages).toHaveLength(3);
    expect(pipeline.stages[0].probability).toBe(0.1);
    expect(pipeline.stages[2].probability).toBe(1.0);
  });

  it("should instantiate a Deal model with financial attributes and history", () => {
    const companyId = new mongoose.Types.ObjectId();
    const pipelineId = new mongoose.Types.ObjectId();
    const deal = new Deal({
      name: "Acme Global Rollout",
      companyId,
      pipelineId,
      stage: "qualification",
      value: 120000,
      annualRecurringRevenue: 100000,
      oneTimeImplementationFee: 20000,
      probability: 0.25,
    });

    expect(deal.name).toBe("Acme Global Rollout");
    expect(deal.value).toBe(120000);
    expect(deal.annualRecurringRevenue).toBe(100000);
    expect(deal.wonDetails?.onboardingHandedOff).toBe(false);
  });

  it("should instantiate SalesTask, Campaign, SalesIntegration, CommThread, and AIInsight models", () => {
    const task = new SalesTask({
      title: "Follow up after product demo",
      type: "follow_up",
      dueDate: new Date(),
    });
    expect(task.status).toBe("pending");

    const campaign = new Campaign({
      name: "Q4 Enterprise Outreach",
      channel: "email",
      createdBy: new mongoose.Types.ObjectId(),
    });
    expect(campaign.status).toBe("draft");
    expect(campaign.stats.sentCount).toBe(0);

    const integration = new SalesIntegration({
      category: "email",
      provider: "ses",
      name: "Production AWS SES",
    });
    expect(integration.status).toBe("not_configured");

    const commThread = new CommThread({
      channel: "email",
      lastMessageAt: new Date(),
    });
    expect(commThread.status).toBe("open");

    const insight = new AIInsight({
      targetType: "lead",
      insightType: "lead_summary",
      title: "Strong Purchase Intent",
      summary: "Evaluator completed demo and inquired about SSO integration.",
      modelUsed: "gpt-4o",
      promptVersion: "1.0.0",
    });
    expect(insight.status).toBe("pending");
    expect(insight.requiresHumanApproval).toBe(true);
  });
});
