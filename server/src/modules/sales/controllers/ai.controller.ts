import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AILeadIntelligenceService } from "../services/ai-lead-intelligence.service.js";
import { AIDealRiskService } from "../services/ai-deal-risk.service.js";
import { ProviderNotConfiguredError } from "../ai/ai-provider.interface.js";
import { AIClientFactory } from "../ai/ai-client.factory.js";
import { Deal } from "../models/deal.model.js";
import { Lead } from "../models/lead.model.js";
import { AIInsight } from "../models/ai-insight.model.js";
import AppError from "../../../common/errors/app-error.js";

const ChatBodySchema = z.object({
  message: z.string().min(1, "Message is required"),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .optional(),
});

const SummarizeLeadParamsSchema = z.object({
  id: z.string().min(1, "Lead ID is required"),
});

const SummarizeLeadBodySchema = z.object({
  forceRefresh: z.boolean().optional(),
});

const AnalyzeDealRiskParamsSchema = z.object({
  id: z.string().min(1, "Deal ID is required"),
});

const AnalyzeDealRiskBodySchema = z.object({
  forceRefresh: z.boolean().optional(),
});

const UpdateInsightStatusParamsSchema = z.object({
  id: z.string().min(1, "Insight ID is required"),
});

const UpdateInsightStatusBodySchema = z.object({
  status: z.enum(["reviewed", "accepted", "dismissed"]),
});

export class AIController {
  private leadIntelligenceService: AILeadIntelligenceService;
  private dealRiskService: AIDealRiskService;

  constructor() {
    this.leadIntelligenceService = new AILeadIntelligenceService();
    this.dealRiskService = new AIDealRiskService();
  }

  /**
   * POST /api/v1/sales/ai/leads/:id/summarize
   */
  public summarizeLead = async (
    request: FastifyRequest<{ Params: { id: string }; Body: { forceRefresh?: boolean } }>,
    reply: FastifyReply
  ) => {
    const paramsParsed = SummarizeLeadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid lead ID parameter",
        errors: paramsParsed.error.errors,
      });
    }

    const bodyParsed = SummarizeLeadBodySchema.safeParse(request.body || {});
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        errors: bodyParsed.error.errors,
      });
    }

    try {
      const result = await this.leadIntelligenceService.generateLeadSummary(
        paramsParsed.data.id,
        { forceRefresh: bodyParsed.data.forceRefresh }
      );

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof ProviderNotConfiguredError || err.code === "PROVIDER_NOT_CONFIGURED") {
        return reply.status(400).send({
          success: false,
          code: "AI_NOT_CONFIGURED",
          message: err.message || "AI provider is not configured. Please configure an API key in Sales Integrations.",
          configured: false,
        });
      }

      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Unhandled error during AI lead summarization");
      return reply.status(500).send({
        success: false,
        code: "AI_INTERNAL_ERROR",
        message: "An internal error occurred while generating the AI lead summary.",
      });
    }
  };

  /**
   * GET /api/v1/sales/ai/leads/:id/insights
   */
  public getLeadInsights = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const paramsParsed = SummarizeLeadParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid lead ID parameter",
        errors: paramsParsed.error.errors,
      });
    }

    try {
      const insights = await this.leadIntelligenceService.getLeadInsights(paramsParsed.data.id);
      return reply.send({
        success: true,
        data: insights,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  };

  /**
   * POST /api/v1/sales/ai/deals/:id/analyze-risk
   */
  public analyzeDealRisk = async (
    request: FastifyRequest<{ Params: { id: string }; Body: { forceRefresh?: boolean } }>,
    reply: FastifyReply
  ) => {
    const paramsParsed = AnalyzeDealRiskParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid deal ID parameter",
        errors: paramsParsed.error.errors,
      });
    }

    const bodyParsed = AnalyzeDealRiskBodySchema.safeParse(request.body || {});
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        errors: bodyParsed.error.errors,
      });
    }

    try {
      const result = await this.dealRiskService.analyzeDealRisk(paramsParsed.data.id, {
        forceRefresh: bodyParsed.data.forceRefresh,
      });

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof ProviderNotConfiguredError || err.code === "PROVIDER_NOT_CONFIGURED") {
        return reply.status(400).send({
          success: false,
          code: "AI_NOT_CONFIGURED",
          message:
            err.message ||
            "AI provider is not configured. Please configure an API key in Sales Integrations.",
          configured: false,
        });
      }

      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Unhandled error during AI deal risk analysis");
      return reply.status(500).send({
        success: false,
        code: "AI_INTERNAL_ERROR",
        message: "An internal error occurred while analyzing deal risk.",
      });
    }
  };

  /**
   * GET /api/v1/sales/ai/deals/:id/insights
   */
  public getDealInsights = async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const paramsParsed = AnalyzeDealRiskParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid deal ID parameter",
        errors: paramsParsed.error.errors,
      });
    }

    try {
      const insights = await this.dealRiskService.getDealInsights(paramsParsed.data.id);
      return reply.send({
        success: true,
        data: insights,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  };

  /**
   * PATCH /api/v1/sales/ai/insights/:id/status
   */
  public updateInsightStatus = async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { status: "reviewed" | "accepted" | "dismissed" };
    }>,
    reply: FastifyReply
  ) => {
    const paramsParsed = UpdateInsightStatusParamsSchema.safeParse(request.params);
    if (!paramsParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid insight ID parameter",
      });
    }

    const bodyParsed = UpdateInsightStatusBodySchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid status value",
        errors: bodyParsed.error.errors,
      });
    }

    try {
      const userId = (request as any).user?.id;
      const updated = await this.leadIntelligenceService.updateInsightStatus(
        paramsParsed.data.id,
        bodyParsed.data.status,
        userId
      );

      return reply.send({
        success: true,
        data: updated,
      });
    } catch (err: any) {
      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
        });
      }
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: err.message,
      });
    }
  };

  /**
   * GET /api/v1/sales/ai/overview
   */
  public getOverview = async (
    request: FastifyRequest<{ Querystring: { simulateOffline?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const simulateOffline = request.query?.simulateOffline === "true";
      const configStatus = simulateOffline
        ? { configured: false, provider: null }
        : await AIClientFactory.getConfigurationStatus();

      if (!configStatus.configured) {
        return reply.send({
          success: true,
          data: {
            configured: false,
            provider: null,
            stats: {
              highRiskDealsCount: 0,
              atRiskPipelineValue: 0,
              highIntentLeadsCount: 0,
              activeInsightsCount: 0,
              totalDealsAnalyzed: 0,
              totalLeadsAnalyzed: 0,
            },
            topRiskDeals: [],
            topIntentLeads: [],
            recentInsights: [],
          },
        });
      }

      // Live MongoDB queries
      const openDeals = await Deal.find({
        stage: { $nin: ["closed_won", "closed_lost"] },
      }).sort({ healthScore: 1, updatedAt: -1 }).limit(20);

      const highRiskDeals = openDeals.filter(
        (d) => (d.healthScore !== undefined && d.healthScore < 60) || (d.riskFlags && d.riskFlags.length > 0)
      );

      const atRiskPipelineValue = highRiskDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      // Top risk deals with enriched insight context
      const topRiskDeals = await Promise.all(
        (highRiskDeals.length > 0 ? highRiskDeals : openDeals).slice(0, 6).map(async (deal) => {
          const lastStage = deal.stageHistory?.[deal.stageHistory.length - 1];
          const daysInCurrentStage = lastStage
            ? Math.floor((Date.now() - new Date(lastStage.changedAt).getTime()) / (1000 * 60 * 60 * 24))
            : Math.floor((Date.now() - new Date(deal.createdAt).getTime()) / (1000 * 60 * 60 * 24));

          const insight = await AIInsight.findOne({
            targetType: "deal",
            targetId: deal._id,
          }).sort({ createdAt: -1 });

          const defaultPlaybook = {
            targetStakeholder: "Key Decision Maker / VP",
            recommendedStrategy: "Schedule executive alignment session with technical architect",
            talkingPoints: [
              "Demonstrate time-to-value within the first 30 days",
              "Review milestone delivery SLAs and implementation roadmap",
              "Present customized enterprise reference case studies",
            ],
            fallbackOffer: "Propose structured 3-month initial pilot with opt-out guarantee",
          };

          return {
            _id: deal._id.toString(),
            name: deal.name,
            value: deal.value || 0,
            currency: deal.currency || "USD",
            stage: deal.stage,
            healthScore: deal.healthScore ?? 55,
            riskFlags: deal.riskFlags?.length ? deal.riskFlags : ["Stage duration elevated", "Budget authority verification needed"],
            daysInCurrentStage,
            latestInsight: {
              summary: insight?.summary || `Deal in '${deal.stage}' requires targeted risk mitigation.`,
              detectedObjections: insight?.metadata?.detectedObjections || deal.riskFlags || [
                "Budget cycle approval delay",
                "Vendor evaluation comparison",
              ],
              rescuePlaybook: insight?.metadata?.rescuePlaybook || defaultPlaybook,
            },
          };
        })
      );

      // Active leads with high intent
      const activeLeads = await Lead.find({
        status: { $in: ["new", "contacted", "engaged", "qualified"] },
      }).sort({ score: -1, updatedAt: -1 }).limit(10);

      const highIntentLeads = activeLeads.filter(
        (l) => l.score >= 50 || l.priority === "high" || l.priority === "urgent"
      );

      const topIntentLeads = await Promise.all(
        (highIntentLeads.length > 0 ? highIntentLeads : activeLeads).slice(0, 6).map(async (lead) => {
          const leadInsight = await AIInsight.findOne({
            targetType: "lead",
            targetId: lead._id,
          }).sort({ createdAt: -1 });

          const badge = lead.score >= 80 ? "Hot Intent" : lead.score >= 60 ? "High Engagement" : "Active Interest";
          const action = leadInsight?.recommendedAction || (lead.score >= 75 ? "Schedule Executive Demo" : "Send Tailored Solution Case Study");

          return {
            _id: lead._id.toString(),
            name: lead.name,
            companyName: lead.companyName || "Prospective Client",
            email: lead.email,
            phone: lead.phone,
            score: lead.score,
            priority: lead.priority || "normal",
            status: lead.status,
            intentBadge: badge,
            recommendedAction: action,
            latestInsight: leadInsight
              ? {
                  title: leadInsight.title,
                  summary: leadInsight.summary,
                  confidence: leadInsight.confidence,
                }
              : undefined,
          };
        })
      );

      const recentInsights = await AIInsight.find().sort({ createdAt: -1 }).limit(10);
      const activeInsightsCount = await AIInsight.countDocuments({ status: "pending" });
      const totalDealsAnalyzed = await AIInsight.countDocuments({ targetType: "deal" });
      const totalLeadsAnalyzed = await AIInsight.countDocuments({ targetType: "lead" });

      return reply.send({
        success: true,
        data: {
          configured: true,
          provider: configStatus.provider,
          stats: {
            highRiskDealsCount: highRiskDeals.length,
            atRiskPipelineValue,
            highIntentLeadsCount: highIntentLeads.length,
            activeInsightsCount,
            totalDealsAnalyzed,
            totalLeadsAnalyzed,
          },
          topRiskDeals,
          topIntentLeads,
          recentInsights,
        },
      });
    } catch (err: any) {
      request.log.error(err, "Error generating AI overview");
      return reply.status(500).send({
        success: false,
        code: "INTERNAL_ERROR",
        message: err.message || "Failed to generate AI overview.",
      });
    }
  };

  /**
   * POST /api/v1/sales/ai/chat
   */
  public chatWithSalesData = async (
    request: FastifyRequest<{
      Body: {
        message: string;
        history?: Array<{ role: "user" | "assistant"; content: string }>;
      };
    }>,
    reply: FastifyReply
  ) => {
    const bodyParsed = ChatBodySchema.safeParse(request.body || {});
    if (!bodyParsed.success) {
      return reply.status(400).send({
        success: false,
        code: "VALIDATION_ERROR",
        message: "Invalid chat payload",
        errors: bodyParsed.error.errors,
      });
    }

    try {
      const configStatus = await AIClientFactory.getConfigurationStatus();
      if (!configStatus.configured) {
        return reply.status(400).send({
          success: false,
          code: "AI_NOT_CONFIGURED",
          message: "AI provider is not configured. Please configure an API key in Sales Integrations.",
          configured: false,
        });
      }

      // Aggregate live database context for LLM grounding
      const totalDeals = await Deal.countDocuments();
      const openDeals = await Deal.find({
        stage: { $nin: ["closed_won", "closed_lost"] },
      }).limit(50);
      const openValue = openDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      const stageCounts: Record<string, number> = {};
      openDeals.forEach((d) => {
        stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
      });

      const atRiskDeals = openDeals.filter(
        (d) => (d.healthScore !== undefined && d.healthScore < 60) || (d.riskFlags && d.riskFlags.length > 0)
      );
      const atRiskValue = atRiskDeals.reduce((sum, d) => sum + (d.value || 0), 0);

      const totalLeads = await Lead.countDocuments();
      const activeLeads = await Lead.countDocuments({
        status: { $in: ["new", "contacted", "engaged", "qualified"] },
      });

      const topRiskNames = atRiskDeals
        .slice(0, 3)
        .map((d) => `${d.name} ($${d.value || 0}, Stage: ${d.stage}, Health: ${d.healthScore ?? 50})`)
        .join("; ");

      const systemPrompt = [
        "You are Talnova AI Sales Intelligence Assistant, an elite executive AI co-pilot for sales leadership.",
        "You have real-time visibility into the live MongoDB CRM database:",
        `- Open Pipeline: ${openDeals.length} deals totaling $${openValue.toLocaleString()} USD across ${totalDeals} historical deals.`,
        `- Pipeline by Stage: ${Object.entries(stageCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "None"}`,
        `- Deals at Risk: ${atRiskDeals.length} deals totaling $${atRiskValue.toLocaleString()} USD.`,
        `- Key At-Risk Opportunities: ${topRiskNames || "None currently flagged."}`,
        `- Total Leads: ${totalLeads} registered, with ${activeLeads} active leads currently progressing.`,
        "",
        "Instructions:",
        "1. Provide concise, direct, and actionable executive insights.",
        "2. Directly cite real pipeline figures and deal names from the live database context above when relevant.",
        "3. Provide structured bullet points or step-by-step guidance when asking for playbooks or next actions.",
      ].join("\n");

      const driver = await AIClientFactory.getActiveProvider();
      const answer = await driver.generateChatResponse(bodyParsed.data.message, systemPrompt);

      return reply.send({
        success: true,
        data: {
          reply: answer,
          provider: driver.providerName,
          timestamp: new Date().toISOString(),
          contextualMetrics: {
            openDealsCount: openDeals.length,
            openPipelineValue: openValue,
            atRiskDealsCount: atRiskDeals.length,
            atRiskPipelineValue: atRiskValue,
            activeLeadsCount: activeLeads,
          },
        },
      });
    } catch (err: any) {
      if (err instanceof ProviderNotConfiguredError || err.code === "PROVIDER_NOT_CONFIGURED") {
        return reply.status(400).send({
          success: false,
          code: "AI_NOT_CONFIGURED",
          message: err.message || "AI provider is not configured. Please configure an API key in Sales Integrations.",
          configured: false,
        });
      }

      if (err instanceof AppError) {
        return reply.status(err.statusCode).send({
          success: false,
          code: err.code,
          message: err.message,
          details: err.details,
        });
      }

      request.log.error(err, "Unhandled error during AI sales chat");
      return reply.status(500).send({
        success: false,
        code: "AI_INTERNAL_ERROR",
        message: "An internal error occurred during the sales chat assistant session.",
      });
    }
  };
}
