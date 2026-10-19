import mongoose from "mongoose";
import { z } from "zod";
import AppError from "../../../common/errors/app-error.js";
import Lead from "../models/lead.model.js";
import CommThread from "../models/comm-thread.model.js";
import AIInsight from "../models/ai-insight.model.js";
import { AIClientFactory } from "../ai/ai-client.factory.js";

export const LeadSummarySchema = z.object({
  summary: z
    .string()
    .describe("A concise 2-4 sentence executive summary of the lead profile, interactions, and current status"),
  buyerIntent: z
    .enum(["low", "medium", "high", "very_high"])
    .describe("Estimated buyer intent level based on behavior, notes, and activity"),
  keyPainPoints: z
    .array(z.string())
    .describe("List of explicit or implied business pain points identified from notes and conversations"),
  suggestedNextAction: z
    .string()
    .describe("Specific, high-leverage next-best-action recommendation for the sales rep"),
  recommendedEmailSnippet: z
    .string()
    .optional()
    .describe("A personalized 1-2 sentence opening or follow-up hook tailored to this lead"),
  confidenceScore: z
    .number()
    .min(0)
    .max(1)
    .optional()
    .describe("Confidence in this evaluation from 0.0 to 1.0"),
});

export type LeadSummaryResult = z.infer<typeof LeadSummarySchema>;

export interface LeadSummaryResponse {
  insightId: string;
  leadId: string;
  summary: string;
  buyerIntent: "low" | "medium" | "high" | "very_high";
  keyPainPoints: string[];
  suggestedNextAction: string;
  recommendedEmailSnippet?: string;
  confidenceScore: number;
  modelUsed: string;
  cached: boolean;
  generatedAt: string;
}

export class AILeadIntelligenceService {
  /**
   * Generates or retrieves cached AI executive summary and action recommendations for a lead
   */
  public async generateLeadSummary(
    leadId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<LeadSummaryResponse> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError(400, "INVALID_ID", "Invalid lead ID format.");
    }

    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new AppError(404, "NOT_FOUND", `Lead with ID '${leadId}' not found.`);
    }

    // 1. Check cached insights if force refresh is not requested
    if (!options?.forceRefresh) {
      const cachedInsight = await AIInsight.findOne({
        targetType: "lead",
        targetId: lead._id,
        insightType: "lead_summary",
      }).sort({ createdAt: -1 });

      if (cachedInsight) {
        const meta = cachedInsight.metadata || {};
        return {
          insightId: cachedInsight._id.toString(),
          leadId: lead._id.toString(),
          summary: cachedInsight.summary,
          buyerIntent: meta.buyerIntent || "medium",
          keyPainPoints: meta.keyPainPoints || cachedInsight.evidence || [],
          suggestedNextAction:
            cachedInsight.recommendedAction || meta.suggestedNextAction || "Follow up with lead",
          recommendedEmailSnippet: meta.recommendedEmailSnippet,
          confidenceScore: cachedInsight.confidence ?? 0.85,
          modelUsed: cachedInsight.modelUsed,
          cached: true,
          generatedAt: cachedInsight.createdAt.toISOString(),
        };
      }
    }

    // 2. Fetch recent communications history for this lead
    let commSnippets: string[] = [];
    try {
      const recentThreads = await CommThread.find({ leadId: lead._id })
        .sort({ updatedAt: -1 })
        .limit(5);

      commSnippets = recentThreads.map((thread) => {
        const lastMsg = thread.messages && thread.messages.length > 0
          ? thread.messages[thread.messages.length - 1]
          : null;
        return `[${thread.channel.toUpperCase()}] Subject: "${thread.subject || "No subject"}" | Status: ${thread.status} | Last Message (${lastMsg?.direction || "inbound"}): "${lastMsg?.body?.slice(0, 150) || "No content"}"`;
      });
    } catch {
      // Proceed without communications if query fails
    }

    // 3. Resolve active AI Provider
    const provider = await AIClientFactory.getActiveProvider();

    // 4. Construct safe, sanitized prompt
    const leadNotes = (lead.notes || [])
      .map((n) => `- [${n.createdAt ? new Date(n.createdAt).toLocaleDateString() : "Recent"}] ${n.content}`)
      .join("\n");

    const prompt = [
      "Please synthesize the following lead profile and engagement history into an executive summary and recommended next action:",
      "",
      `Lead Name: ${lead.name}`,
      `Company: ${lead.companyName}`,
      `Job Title: ${lead.jobTitle || "Not specified"}`,
      `Industry: ${lead.industry || "Not specified"}`,
      `Company Size: ${lead.companySize || "Not specified"}`,
      `Source: ${lead.source || "Inbound"}`,
      `Status: ${lead.status}`,
      `Current Priority: ${lead.priority}`,
      `Lead Score: ${lead.score || 0}`,
      `Tags: ${(lead.tags || []).join(", ") || "None"}`,
      "",
      "Lead Notes:",
      leadNotes || "No notes recorded yet.",
      "",
      "Recent Communications History:",
      commSnippets.join("\n") || "No message history recorded yet.",
    ].join("\n");

    const systemContext = [
      "You are an elite B2B sales intelligence advisor analyzing inbound leads for an enterprise software platform.",
      "Your objective is to synthesize the lead's history, evaluate buyer intent, identify explicit pain points, and recommend the single highest-leverage next action for the sales representative.",
      "Be concise, actionable, and pragmatic. Do not include assumptions not backed by the provided notes or activity.",
    ].join("\n");

    // 5. Generate structured response strictly validated by Zod
    const aiResult = await provider.generateStructuredResponse(
      prompt,
      LeadSummarySchema,
      systemContext,
      { temperature: 0.2 }
    );

    // 6. Persist generated insight to MongoDB
    const priority =
      aiResult.buyerIntent === "very_high" || aiResult.buyerIntent === "high"
        ? "high"
        : "normal";

    const insight = await AIInsight.create({
      targetType: "lead",
      targetId: lead._id,
      insightType: "lead_summary",
      title: `AI Executive Summary: ${lead.companyName || lead.name}`,
      summary: aiResult.summary,
      recommendedAction: aiResult.suggestedNextAction,
      priority,
      evidence: aiResult.keyPainPoints,
      confidence: aiResult.confidenceScore ?? 0.85,
      requiresHumanApproval: true,
      status: "pending",
      modelUsed: provider.defaultModel || "ai-model",
      promptVersion: "1.0.0",
      metadata: {
        buyerIntent: aiResult.buyerIntent,
        keyPainPoints: aiResult.keyPainPoints,
        suggestedNextAction: aiResult.suggestedNextAction,
        recommendedEmailSnippet: aiResult.recommendedEmailSnippet,
        confidenceScore: aiResult.confidenceScore ?? 0.85,
      },
    });

    return {
      insightId: insight._id.toString(),
      leadId: lead._id.toString(),
      summary: aiResult.summary,
      buyerIntent: aiResult.buyerIntent,
      keyPainPoints: aiResult.keyPainPoints,
      suggestedNextAction: aiResult.suggestedNextAction,
      recommendedEmailSnippet: aiResult.recommendedEmailSnippet,
      confidenceScore: aiResult.confidenceScore ?? 0.85,
      modelUsed: provider.defaultModel || "ai-model",
      cached: false,
      generatedAt: insight.createdAt.toISOString(),
    };
  }

  /**
   * Retrieves all historical AI insights for a specific lead
   */
  public async getLeadInsights(leadId: string): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      throw new AppError(400, "INVALID_ID", "Invalid lead ID format.");
    }

    const insights = await AIInsight.find({
      targetType: "lead",
      targetId: new mongoose.Types.ObjectId(leadId),
    }).sort({ createdAt: -1 });

    return insights;
  }

  /**
   * Updates an insight's review status (e.g. accepted, dismissed, reviewed)
   */
  public async updateInsightStatus(
    insightId: string,
    status: "reviewed" | "accepted" | "dismissed",
    userId?: string
  ): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(insightId)) {
      throw new AppError(400, "INVALID_ID", "Invalid insight ID format.");
    }

    const update: any = {
      status,
      reviewedAt: new Date(),
    };

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      update.reviewedBy = new mongoose.Types.ObjectId(userId);
    }

    const updated = await AIInsight.findByIdAndUpdate(insightId, update, { new: true });
    if (!updated) {
      throw new AppError(404, "NOT_FOUND", `Insight with ID '${insightId}' not found.`);
    }

    return updated;
  }
}
