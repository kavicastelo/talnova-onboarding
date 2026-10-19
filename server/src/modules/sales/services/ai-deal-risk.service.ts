import mongoose from "mongoose";
import { z } from "zod";
import AppError from "../../../common/errors/app-error.js";
import Deal from "../models/deal.model.js";
import CommThread from "../models/comm-thread.model.js";
import SalesTask from "../models/task.model.js";
import AIInsight from "../models/ai-insight.model.js";
import { AIClientFactory } from "../ai/ai-client.factory.js";

export const DealRiskSchema = z.object({
  riskLevel: z
    .enum(["low", "medium", "high", "critical"])
    .describe("Overall risk category for the deal"),
  riskScore: z
    .number()
    .min(0)
    .max(100)
    .describe("Numerical risk rating (0 = virtually no risk, 100 = extreme risk of loss)"),
  healthScore: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Computed health score (100 - riskScore)"),
  detectedObjections: z
    .array(z.string())
    .describe("Specific customer objections identified from communications and notes"),
  competitorMentions: z
    .array(z.string())
    .describe("Competitors mentioned by the customer"),
  recommendedAction: z
    .string()
    .describe("Immediate tactical step for the account executive"),
  rescuePlaybook: z
    .string()
    .describe("Strategic playbook recommendation to de-risk and salvage the opportunity"),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Confidence score in this assessment from 0.0 to 1.0"),
});

export type DealRiskResult = z.infer<typeof DealRiskSchema>;

export interface DealRiskResponse {
  insightId: string;
  dealId: string;
  dealName: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  healthScore: number;
  detectedObjections: string[];
  competitorMentions: string[];
  recommendedAction: string;
  rescuePlaybook: string;
  confidenceScore: number;
  modelUsed: string;
  cached: boolean;
  generatedAt: string;
}

export class AIDealRiskService {
  /**
   * Analyzes risk, objections, and rescue strategy for an open sales deal
   */
  public async analyzeDealRisk(
    dealId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<DealRiskResponse> {
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      throw new AppError(400, "INVALID_ID", "Invalid deal ID format.");
    }

    const deal = await Deal.findById(dealId)
      .populate("companyId", "name domain industry")
      .populate("primaryContactId", "name email phone title");

    if (!deal) {
      throw new AppError(404, "NOT_FOUND", `Deal with ID '${dealId}' not found.`);
    }

    // 1. Check cached insights if force refresh is not requested
    if (!options?.forceRefresh) {
      const cachedInsight = await AIInsight.findOne({
        targetType: "deal",
        targetId: deal._id,
        insightType: "deal_risk",
      }).sort({ createdAt: -1 });

      if (cachedInsight) {
        const meta = cachedInsight.metadata || {};
        return {
          insightId: cachedInsight._id.toString(),
          dealId: deal._id.toString(),
          dealName: deal.name,
          riskLevel: meta.riskLevel || "medium",
          riskScore: meta.riskScore ?? 50,
          healthScore: meta.healthScore ?? 50,
          detectedObjections: meta.detectedObjections || cachedInsight.evidence || [],
          competitorMentions: meta.competitorMentions || [],
          recommendedAction:
            cachedInsight.recommendedAction || meta.recommendedAction || "Review deal status",
          rescuePlaybook: meta.rescuePlaybook || cachedInsight.summary,
          confidenceScore: cachedInsight.confidence ?? 0.85,
          modelUsed: cachedInsight.modelUsed,
          cached: true,
          generatedAt: cachedInsight.createdAt.toISOString(),
        };
      }
    }

    // 2. Fetch linked communications and tasks context
    let commSnippets: string[] = [];
    try {
      const recentThreads = await CommThread.find({ dealId: deal._id })
        .sort({ updatedAt: -1 })
        .limit(5);

      commSnippets = recentThreads.map((thread) => {
        const lastMsg =
          thread.messages && thread.messages.length > 0
            ? thread.messages[thread.messages.length - 1]
            : null;
        return `[${thread.channel.toUpperCase()}] Subject: "${thread.subject || "No subject"}" | Status: ${thread.status} | Last message: "${lastMsg?.body?.slice(0, 150) || "No content"}"`;
      });
    } catch {
      // Proceed without communications if query fails
    }

    let taskSnippets: string[] = [];
    try {
      const tasks = await SalesTask.find({ dealId: deal._id })
        .sort({ dueDate: -1 })
        .limit(5);

      taskSnippets = tasks.map(
        (t) => `[Task: ${t.type.toUpperCase()}] "${t.title}" | Priority: ${t.priority} | Status: ${t.status} | Due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "None"}`
      );
    } catch {
      // Proceed without tasks if query fails
    }

    // 3. Resolve active AI Provider
    const provider = await AIClientFactory.getActiveProvider();

    // 4. Construct prompt
    const company = deal.companyId as any;
    const contact = deal.primaryContactId as any;
    const daysSinceUpdate = Math.floor(
      (Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 3600 * 24)
    );

    const prompt = [
      "Please perform a deep risk diagnostic and objection analysis for the following sales opportunity:",
      "",
      `Deal Name: ${deal.name}`,
      `Current Stage: ${deal.stage}`,
      `Deal Value: $${deal.value?.toLocaleString() || 0} (ARR: $${deal.annualRecurringRevenue?.toLocaleString() || 0})`,
      `Win Probability: ${Math.round((deal.probability || 0.1) * 100)}%`,
      `Days in Current Stage / Stagnant: ${daysSinceUpdate} days`,
      `Expected Close Date: ${deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : "Not specified"}`,
      `Known Competitors: ${(deal.competitors || []).join(", ") || "None recorded"}`,
      `Current Next Action: ${deal.nextAction || "None"}`,
      "",
      `Target Account: ${company?.name || "Unknown Company"} (${company?.industry || "Industry not specified"})`,
      `Primary Decision Maker: ${contact?.name || "Not assigned"} (${contact?.title || "No title"})`,
      "",
      "Deal Notes & Context:",
      deal.notes || "No notes recorded.",
      "",
      "Recent Communications:",
      commSnippets.join("\n") || "No message records found.",
      "",
      "Associated Sales Tasks:",
      taskSnippets.join("\n") || "No tasks scheduled.",
    ].join("\n");

    const systemContext = [
      "You are a principal enterprise deal strategist and revenue intelligence advisor.",
      "Your objective is to evaluate risk signals, identify hidden or unaddressed customer objections, track competitive threats, and prescribe a rescue playbook to ensure the deal closes successfully.",
      "Be decisive, pragmatic, and provide concrete tactical actions.",
    ].join("\n");

    // 5. Generate structured response strictly validated by Zod
    const aiResult = await provider.generateStructuredResponse(
      prompt,
      DealRiskSchema,
      systemContext,
      { temperature: 0.2 }
    );

    // 6. Compute healthScore & update Deal document
    const computedHealthScore =
      aiResult.healthScore ?? Math.max(0, 100 - aiResult.riskScore);

    await Deal.findByIdAndUpdate(deal._id, {
      healthScore: computedHealthScore,
      riskFlags: aiResult.detectedObjections,
      nextAction: aiResult.recommendedAction,
    });

    // 7. Persist insight to MongoDB AIInsight collection
    const priority =
      aiResult.riskLevel === "critical"
        ? "urgent"
        : aiResult.riskLevel === "high"
        ? "high"
        : "normal";

    const insight = await AIInsight.create({
      targetType: "deal",
      targetId: deal._id,
      insightType: "deal_risk",
      title: `Deal Risk Analysis: ${deal.name}`,
      summary: `Risk Level: ${aiResult.riskLevel.toUpperCase()} (Score: ${aiResult.riskScore}/100, Health: ${computedHealthScore}/100). ${aiResult.rescuePlaybook}`,
      recommendedAction: aiResult.recommendedAction,
      priority,
      evidence: [
        ...aiResult.detectedObjections,
        ...aiResult.competitorMentions.map((c) => `Competitor: ${c}`),
      ],
      confidence: aiResult.confidenceScore ?? 0.88,
      requiresHumanApproval: true,
      status: "pending",
      modelUsed: provider.defaultModel || "ai-model",
      promptVersion: "1.0.0",
      metadata: {
        riskLevel: aiResult.riskLevel,
        riskScore: aiResult.riskScore,
        healthScore: computedHealthScore,
        detectedObjections: aiResult.detectedObjections,
        competitorMentions: aiResult.competitorMentions,
        recommendedAction: aiResult.recommendedAction,
        rescuePlaybook: aiResult.rescuePlaybook,
        confidenceScore: aiResult.confidenceScore ?? 0.88,
      },
    });

    return {
      insightId: insight._id.toString(),
      dealId: deal._id.toString(),
      dealName: deal.name,
      riskLevel: aiResult.riskLevel,
      riskScore: aiResult.riskScore,
      healthScore: computedHealthScore,
      detectedObjections: aiResult.detectedObjections,
      competitorMentions: aiResult.competitorMentions,
      recommendedAction: aiResult.recommendedAction,
      rescuePlaybook: aiResult.rescuePlaybook,
      confidenceScore: aiResult.confidenceScore ?? 0.88,
      modelUsed: provider.defaultModel || "ai-model",
      cached: false,
      generatedAt: insight.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves all historical AI insights for a specific deal
   */
  public async getDealInsights(dealId: string): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(dealId)) {
      throw new AppError(400, "INVALID_ID", "Invalid deal ID format.");
    }

    const insights = await AIInsight.find({
      targetType: "deal",
      targetId: new mongoose.Types.ObjectId(dealId),
    }).sort({ createdAt: -1 });

    return insights;
  }
}
