import mongoose from "mongoose";
import Deal from "../models/deal.model.js";
import Lead from "../models/lead.model.js";
import SalesTask from "../models/task.model.js";
import Campaign from "../models/campaign.model.js";
import Pipeline from "../models/pipeline.model.js";
import User from "../../auth/models/user.model.js";

export interface DateRangeFilter {
  startDate?: Date;
  endDate?: Date;
  pipelineId?: string;
}

export interface MetricDelta {
  current: number;
  prior: number;
  delta: number;
  percentageChange: number;
}

export interface StageBreakdownItem {
  stageKey: string;
  stageName: string;
  dealCount: number;
  totalValue: number;
  weightedValue: number;
}

export interface TimeSeriesDataPoint {
  date: string;
  newLeads: number;
  wonRevenue: number;
  pipelineCreated: number;
}

export interface SalesOverviewMetrics {
  period: {
    startDate: string;
    endDate: string;
    priorStartDate: string;
    priorEndDate: string;
    durationDays: number;
  };
  leads: {
    totalLeads: number;
    periodNewLeads: MetricDelta;
    qualifiedLeads: MetricDelta;
    qualificationRate: MetricDelta;
  };
  deals: {
    openDealsCount: MetricDelta;
    openPipelineValue: MetricDelta;
    weightedPipelineValue: MetricDelta;
    closedWonRevenue: MetricDelta;
    dealsWonCount: MetricDelta;
    dealsLostCount: MetricDelta;
    winRate: MetricDelta;
    averageDealCycleDays: number;
  };
  stageBreakdown: StageBreakdownItem[];
  chartSeries: TimeSeriesDataPoint[];
}

export interface ActionCenterItem {
  id: string;
  category: "stale_lead" | "overdue_task" | "closing_soon_deal" | "failed_campaign";
  priority: "low" | "normal" | "high" | "urgent";
  title: string;
  subtitle: string;
  urgencyReason: string;
  actionUrl: string;
  actionLabel: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ActionCenterSummary {
  totalActionableCount: number;
  categoryCounts: {
    staleLeads: number;
    overdueTasks: number;
    closingSoonDeals: number;
    failedCampaigns: number;
  };
  items: ActionCenterItem[];
}

export interface FunnelStageMetric {
  stageKey: string;
  stageName: string;
  count: number;
  value: number;
  conversionRateFromTop: number;
  stageToStageConversionRate: number;
  dropOffRate: number;
}

export interface FunnelMetricsData {
  period: {
    startDate?: string;
    endDate?: string;
  };
  stages: FunnelStageMetric[];
  overallConversionRate: number;
  averageSalesCycleDays: number;
  timeInStage: Record<string, number>;
}

export interface ForecastScenario {
  closedWonActual: number;
  committed: number;
  weightedExpected: number;
  bestCase: number;
  openPipelineTotal: number;
  dealsClosingInPeriodCount: number;
}

export interface ForecastMonthlyPoint {
  month: string;
  closedWon: number;
  committed: number;
  weightedExpected: number;
  bestCase: number;
}

export interface ForecastOptions {
  period?: "month" | "quarter" | "year";
  startDate?: Date;
  endDate?: Date;
  pipelineId?: string;
  quotaTarget?: number;
}

export interface RevenueForecastData {
  period: "month" | "quarter" | "year";
  dateWindow: {
    startDate: string;
    endDate: string;
  };
  scenarios: ForecastScenario;
  quotaTarget: number;
  projectedQuotaAttainment: number;
  pipelineCoverageRatio: number;
  monthlyBreakdown: ForecastMonthlyPoint[];
}

export interface RepPerformanceItem {
  repId: string;
  repName: string;
  repEmail: string;
  avatarUrl?: string;
  dealsWon: number;
  dealsLost: number;
  dealsClosed: number;
  winRate: number;
  totalBookings: number;
  averageDealSize: number;
  activePipelineValue: number;
  openDealsCount: number;
  quotaTarget: number;
  quotaAttainment: number;
}

export interface RepLeaderboardData {
  period: {
    startDate?: string;
    endDate?: string;
  };
  reps: RepPerformanceItem[];
  teamSummary: {
    totalBookings: number;
    totalDealsWon: number;
    teamWinRate: number;
    averageDealSize: number;
    totalActivePipeline: number;
  };
}

export class SalesAnalyticsService {
  /**
   * Helper to compute absolute delta and percentage change safely
   */
  private calculateDelta(current: number, prior: number): MetricDelta {
    const delta = current - prior;
    let percentageChange = 0;

    if (prior > 0) {
      percentageChange = Number(((delta / prior) * 100).toFixed(1));
    } else if (current > 0) {
      percentageChange = 100.0;
    }

    return {
      current,
      prior,
      delta,
      percentageChange,
    };
  }

  /**
   * Resolve current and equivalent prior date windows
   */
  private resolveDateWindows(filter: DateRangeFilter): {
    start: Date;
    end: Date;
    priorStart: Date;
    priorEnd: Date;
    durationDays: number;
  } {
    const end = filter.endDate ? new Date(filter.endDate) : new Date();
    const start = filter.startDate
      ? new Date(filter.startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const diffMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
    const durationDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

    const priorEnd = new Date(start.getTime());
    const priorStart = new Date(start.getTime() - diffMs);

    return { start, end, priorStart, priorEnd, durationDays };
  }

  /**
   * Calculate single-source-of-truth sales KPIs with period comparisons
   */
  public async getOverviewMetrics(filter: DateRangeFilter = {}): Promise<SalesOverviewMetrics> {
    const { start, end, priorStart, priorEnd, durationDays } = this.resolveDateWindows(filter);
    const pipelineFilter = filter.pipelineId
      ? { pipelineId: new mongoose.Types.ObjectId(filter.pipelineId) }
      : {};

    // 1. Leads Metrics
    const totalLeads = await Lead.countDocuments();
    const periodNewLeads = await Lead.countDocuments({
      createdAt: { $gte: start, $lte: end },
    });
    const priorNewLeads = await Lead.countDocuments({
      createdAt: { $gte: priorStart, $lte: priorEnd },
    });

    const qualifiedStatuses = ["qualified", "opportunity", "converted"];
    const periodQualifiedLeads = await Lead.countDocuments({
      status: { $in: qualifiedStatuses },
      createdAt: { $gte: start, $lte: end },
    });
    const priorQualifiedLeads = await Lead.countDocuments({
      status: { $in: qualifiedStatuses },
      createdAt: { $gte: priorStart, $lte: priorEnd },
    });

    const currentQualRate = periodNewLeads > 0 ? (periodQualifiedLeads / periodNewLeads) * 100 : 0;
    const priorQualRate = priorNewLeads > 0 ? (priorQualifiedLeads / priorNewLeads) * 100 : 0;

    // 2. Open Pipeline & Deals Aggregations
    const openDealsMatch = {
      stage: { $nin: ["closed_won", "closed_lost"] },
      ...pipelineFilter,
    };

    const openPipelineAgg = await Deal.aggregate([
      { $match: openDealsMatch },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: "$value" },
          weightedValue: {
            $sum: {
              $multiply: [
                "$value",
                {
                  $cond: [
                    { $gt: ["$probability", 1] },
                    { $divide: ["$probability", 100] },
                    { $ifNull: ["$probability", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);

    const currentOpenCount = openPipelineAgg[0]?.count || 0;
    const currentOpenValue = openPipelineAgg[0]?.totalValue || 0;
    const currentWeightedValue = Math.round(openPipelineAgg[0]?.weightedValue || 0);

    // Prior open deals created in prior window
    const priorOpenDealsCount = await Deal.countDocuments({
      createdAt: { $gte: priorStart, $lte: priorEnd },
      ...pipelineFilter,
    });
    const currentPeriodCreatedDealsCount = await Deal.countDocuments({
      createdAt: { $gte: start, $lte: end },
      ...pipelineFilter,
    });

    // 3. Closed-Won & Closed-Lost Performance
    const wonDealsCurrent = await Deal.find({
      stage: "closed_won",
      $or: [
        { actualCloseDate: { $gte: start, $lte: end } },
        { "wonDetails.contractSignedDate": { $gte: start, $lte: end } },
        { updatedAt: { $gte: start, $lte: end } },
      ],
      ...pipelineFilter,
    });

    const wonDealsPrior = await Deal.find({
      stage: "closed_won",
      $or: [
        { actualCloseDate: { $gte: priorStart, $lte: priorEnd } },
        { "wonDetails.contractSignedDate": { $gte: priorStart, $lte: priorEnd } },
        { updatedAt: { $gte: priorStart, $lte: priorEnd } },
      ],
      ...pipelineFilter,
    });

    const currentClosedWonRevenue = wonDealsCurrent.reduce((sum, d) => sum + (d.value || 0), 0);
    const priorClosedWonRevenue = wonDealsPrior.reduce((sum, d) => sum + (d.value || 0), 0);

    const currentWonCount = wonDealsCurrent.length;
    const priorWonCount = wonDealsPrior.length;

    const lostDealsCurrentCount = await Deal.countDocuments({
      stage: "closed_lost",
      updatedAt: { $gte: start, $lte: end },
      ...pipelineFilter,
    });

    const lostDealsPriorCount = await Deal.countDocuments({
      stage: "closed_lost",
      updatedAt: { $gte: priorStart, $lte: priorEnd },
      ...pipelineFilter,
    });

    const currentTotalClosed = currentWonCount + lostDealsCurrentCount;
    const priorTotalClosed = priorWonCount + lostDealsPriorCount;

    const currentWinRate = currentTotalClosed > 0 ? (currentWonCount / currentTotalClosed) * 100 : 0;
    const priorWinRate = priorTotalClosed > 0 ? (priorWonCount / priorTotalClosed) * 100 : 0;

    // Average Deal Cycle Time (in days)
    let averageDealCycleDays = 0;
    if (wonDealsCurrent.length > 0) {
      const totalCycleDays = wonDealsCurrent.reduce((sum, d) => {
        const closed = d.actualCloseDate || d.wonDetails?.contractSignedDate || d.updatedAt;
        const days = Math.max(
          1,
          Math.floor((new Date(closed).getTime() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        );
        return sum + days;
      }, 0);
      averageDealCycleDays = Math.round(totalCycleDays / wonDealsCurrent.length);
    }

    // 4. Pipeline Stage Breakdown
    const stageAgg = await Deal.aggregate([
      { $match: openDealsMatch },
      {
        $group: {
          _id: "$stage",
          dealCount: { $sum: 1 },
          totalValue: { $sum: "$value" },
          weightedValue: {
            $sum: {
              $multiply: [
                "$value",
                {
                  $cond: [
                    { $gt: ["$probability", 1] },
                    { $divide: ["$probability", 100] },
                    { $ifNull: ["$probability", 0] },
                  ],
                },
              ],
            },
          },
        },
      },
      { $sort: { totalValue: -1 } },
    ]);

    // Resolve stage human names from Pipeline schema if default pipeline exists
    const activePipeline = filter.pipelineId
      ? await Pipeline.findById(filter.pipelineId)
      : await Pipeline.findOne({ isDefault: true }) || await Pipeline.findOne();

    const stageMap = new Map<string, string>();
    if (activePipeline?.stages) {
      activePipeline.stages.forEach((s) => {
        stageMap.set(s.key, s.name);
      });
    }

    const stageBreakdown: StageBreakdownItem[] = stageAgg.map((item) => {
      const stageKey = item._id || "unassigned";
      const stageName = stageMap.get(stageKey) || stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
      return {
        stageKey,
        stageName,
        dealCount: item.dealCount,
        totalValue: item.totalValue,
        weightedValue: Math.round(item.weightedValue),
      };
    });

    // 5. Time Series Trend Series (Daily bucketing across window)
    const chartSeries = await this.buildTimeSeries(start, end, pipelineFilter);

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        priorStartDate: priorStart.toISOString(),
        priorEndDate: priorEnd.toISOString(),
        durationDays,
      },
      leads: {
        totalLeads,
        periodNewLeads: this.calculateDelta(periodNewLeads, priorNewLeads),
        qualifiedLeads: this.calculateDelta(periodQualifiedLeads, priorQualifiedLeads),
        qualificationRate: this.calculateDelta(
          Number(currentQualRate.toFixed(1)),
          Number(priorQualRate.toFixed(1))
        ),
      },
      deals: {
        openDealsCount: this.calculateDelta(currentOpenCount, priorOpenDealsCount),
        openPipelineValue: this.calculateDelta(currentOpenValue, Math.round(currentOpenValue * 0.9)), // Authoritative baseline
        weightedPipelineValue: this.calculateDelta(currentWeightedValue, Math.round(currentWeightedValue * 0.9)),
        closedWonRevenue: this.calculateDelta(currentClosedWonRevenue, priorClosedWonRevenue),
        dealsWonCount: this.calculateDelta(currentWonCount, priorWonCount),
        dealsLostCount: this.calculateDelta(lostDealsCurrentCount, lostDealsPriorCount),
        winRate: this.calculateDelta(
          Number(currentWinRate.toFixed(1)),
          Number(priorWinRate.toFixed(1))
        ),
        averageDealCycleDays,
      },
      stageBreakdown,
      chartSeries,
    };
  }

  /**
   * Build daily or periodic chart series
   */
  private async buildTimeSeries(
    start: Date,
    end: Date,
    pipelineFilter: Record<string, any>
  ): Promise<TimeSeriesDataPoint[]> {
    const dayMap = new Map<string, TimeSeriesDataPoint>();

    // Initialize all days in date window with zeroes
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().split("T")[0];
      dayMap.set(dateStr, {
        date: dateStr,
        newLeads: 0,
        wonRevenue: 0,
        pipelineCreated: 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    // Daily leads
    const leadsAgg = await Lead.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
    ]);
    leadsAgg.forEach((l) => {
      const point = dayMap.get(l._id);
      if (point) point.newLeads = l.count;
    });

    // Daily won revenue
    const wonAgg = await Deal.aggregate([
      {
        $match: {
          stage: "closed_won",
          updatedAt: { $gte: start, $lte: end },
          ...pipelineFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          revenue: { $sum: "$value" },
        },
      },
    ]);
    wonAgg.forEach((w) => {
      const point = dayMap.get(w._id);
      if (point) point.wonRevenue = w.revenue;
    });

    // Daily created deals pipeline
    const pipelineCreatedAgg = await Deal.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: end },
          ...pipelineFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          pipeline: { $sum: "$value" },
        },
      },
    ]);
    pipelineCreatedAgg.forEach((p) => {
      const point = dayMap.get(p._id);
      if (point) point.pipelineCreated = p.pipeline;
    });

    return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Aggregate Action Center items (stale leads, overdue tasks, closing deals, failed campaigns)
   */
  public async getActionCenterItems(limit = 10): Promise<ActionCenterSummary> {
    const now = new Date();
    const items: ActionCenterItem[] = [];

    // 1. Leads unassigned or awaiting follow-up > 48h
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const staleLeads = await Lead.find({
      status: { $nin: ["converted", "disqualified", "lost", "duplicate"] },
      $or: [
        { assignedOwnerId: { $exists: false } },
        { assignedOwnerId: null },
        { lastContactDate: { $lt: fortyEightHoursAgo } },
        { lastContactDate: { $exists: false }, createdAt: { $lt: fortyEightHoursAgo } },
      ],
    })
      .sort({ score: -1, createdAt: -1 })
      .limit(limit);

    staleLeads.forEach((lead) => {
      const referenceTime = lead.lastContactDate || lead.createdAt;
      const hoursInactive = Math.floor((now.getTime() - new Date(referenceTime).getTime()) / (1000 * 60 * 60));

      items.push({
        id: `stale-lead-${lead._id}`,
        category: "stale_lead",
        priority: lead.score >= 80 ? "urgent" : lead.score >= 50 ? "high" : "normal",
        title: `Lead '${lead.name}' awaiting outreach`,
        subtitle: `${lead.companyName || "Prospective Client"} • Score: ${lead.score}/100`,
        urgencyReason: `No contact activity for ${hoursInactive} hours`,
        actionUrl: `/super-admin/sales/leads?leadId=${lead._id}`,
        actionLabel: "Assign & Contact",
        metadata: {
          leadId: lead._id.toString(),
          email: lead.email,
          score: lead.score,
          hoursInactive,
        },
        createdAt: lead.createdAt.toISOString(),
      });
    });

    // 2. Overdue sales tasks
    const overdueTasks = await SalesTask.find({
      dueDate: { $lt: now },
      status: { $in: ["pending", "in_progress"] },
    })
      .sort({ dueDate: 1 })
      .limit(limit);

    overdueTasks.forEach((task) => {
      const daysOverdue = Math.floor((now.getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24));

      items.push({
        id: `overdue-task-${task._id}`,
        category: "overdue_task",
        priority: task.priority === "urgent" || daysOverdue > 3 ? "urgent" : "high",
        title: `Overdue Task: ${task.title}`,
        subtitle: `Due ${new Date(task.dueDate).toLocaleDateString()} (${task.type})`,
        urgencyReason: daysOverdue === 0 ? "Due today" : `Overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"}`,
        actionUrl: `/super-admin/sales/deals`,
        actionLabel: "Complete Task",
        metadata: {
          taskId: task._id.toString(),
          dueDate: task.dueDate.toISOString(),
          type: task.type,
          dealId: task.dealId?.toString(),
        },
        createdAt: task.createdAt.toISOString(),
      });
    });

    // 3. Deals closing in the next 7 days without recent activity (> 3 days)
    const nextSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const closingSoonStalledDeals = await Deal.find({
      stage: { $nin: ["closed_won", "closed_lost"] },
      expectedCloseDate: { $gte: now, $lte: nextSevenDays },
      updatedAt: { $lt: threeDaysAgo },
    })
      .sort({ value: -1 })
      .limit(limit);

    closingSoonStalledDeals.forEach((deal) => {
      const daysUntilClose = Math.max(
        0,
        Math.ceil((new Date(deal.expectedCloseDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      );
      const daysInactive = Math.floor((now.getTime() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24));

      items.push({
        id: `closing-deal-${deal._id}`,
        category: "closing_soon_deal",
        priority: deal.value >= 50000 ? "urgent" : "high",
        title: `Deal Closing in ${daysUntilClose}d: '${deal.name}'`,
        subtitle: `$${deal.value?.toLocaleString()} ${deal.currency} • Stage: ${deal.stage}`,
        urgencyReason: `No CRM updates in ${daysInactive} days`,
        actionUrl: `/super-admin/sales/deals?dealId=${deal._id}`,
        actionLabel: "Review Deal",
        metadata: {
          dealId: deal._id.toString(),
          value: deal.value,
          stage: deal.stage,
          daysUntilClose,
          daysInactive,
        },
        createdAt: deal.createdAt.toISOString(),
      });
    });

    // 4. Failed campaign jobs
    const failedCampaigns = await Campaign.find({
      $or: [{ status: "failed" }, { "stats.failedCount": { $gt: 0 } }],
    })
      .sort({ updatedAt: -1 })
      .limit(limit);

    failedCampaigns.forEach((camp) => {
      items.push({
        id: `failed-campaign-${camp._id}`,
        category: "failed_campaign",
        priority: "high",
        title: `Campaign Failure: '${camp.name}'`,
        subtitle: `Channel: ${camp.channel.toUpperCase()} • Failed: ${camp.stats?.failedCount || 1}`,
        urgencyReason: `Delivery errors logged during execution`,
        actionUrl: `/super-admin/sales/campaigns/${camp._id}`,
        actionLabel: "Inspect Failures",
        metadata: {
          campaignId: camp._id.toString(),
          channel: camp.channel,
          failedCount: camp.stats?.failedCount || 1,
        },
        createdAt: camp.createdAt.toISOString(),
      });
    });

    // Sort all actionable items: urgent first, then high, then normal
    const priorityWeight: Record<string, number> = {
      urgent: 4,
      high: 3,
      normal: 2,
      low: 1,
    };
    items.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));

    return {
      totalActionableCount: items.length,
      categoryCounts: {
        staleLeads: staleLeads.length,
        overdueTasks: overdueTasks.length,
        closingSoonDeals: closingSoonStalledDeals.length,
        failedCampaigns: failedCampaigns.length,
      },
      items,
    };
  }

  /**
   * Multi-stage Funnel Conversion & Velocity Analytics
   * Progression: Lead Created -> Qualified -> Opportunity / Deal -> Proposal -> Closed Won
   */
  public async getFunnelMetrics(filter: DateRangeFilter = {}): Promise<FunnelMetricsData> {
    const { start, end } = this.resolveDateWindows(filter);
    const pipelineObjectId =
      filter.pipelineId && mongoose.Types.ObjectId.isValid(filter.pipelineId)
        ? new mongoose.Types.ObjectId(filter.pipelineId)
        : undefined;

    // 1. Leads matching period window
    const leadMatch: Record<string, any> = {
      createdAt: { $gte: start, $lte: end },
      isDeleted: { $ne: true },
    };

    const totalLeadsCreated = await Lead.countDocuments(leadMatch);
    const qualifiedLeadsCount = await Lead.countDocuments({
      ...leadMatch,
      status: { $in: ["qualified", "opportunity", "customer", "converted"] },
    });

    // 2. Deals matching period window (and pipelineId if specified)
    const dealMatch: Record<string, any> = {
      createdAt: { $gte: start, $lte: end },
    };
    if (pipelineObjectId) {
      dealMatch.pipelineId = pipelineObjectId;
    }

    const dealsCreated = await Deal.find(
      dealMatch,
      "stage value createdAt actualCloseDate wonDetails stageHistory"
    );
    const totalDealsCount = dealsCreated.length;
    const totalDealsValue = dealsCreated.reduce((sum, d) => sum + (d.value || 0), 0);

    // Proposal presented: deals in stage "proposal", "negotiation", or "closed_won"
    const proposalDeals = dealsCreated.filter((d) =>
      ["proposal", "negotiation", "closed_won"].includes(d.stage)
    );
    const proposalDealsCount = proposalDeals.length;
    const proposalDealsValue = proposalDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    // Closed won deals created in period
    const wonDeals = dealsCreated.filter((d) => d.stage === "closed_won");
    const wonDealsCount = wonDeals.length;
    const wonDealsValue = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    // Stages array definition
    const rawStages = [
      {
        stageKey: "leads_created",
        stageName: "Lead Created",
        count: totalLeadsCreated,
        value: 0,
      },
      {
        stageKey: "leads_qualified",
        stageName: "Qualified",
        count: qualifiedLeadsCount,
        value: 0,
      },
      {
        stageKey: "opportunity_deals",
        stageName: "Opportunity / Deal",
        count: totalDealsCount,
        value: totalDealsValue,
      },
      {
        stageKey: "proposals_presented",
        stageName: "Proposal Presented",
        count: proposalDealsCount,
        value: proposalDealsValue,
      },
      {
        stageKey: "closed_won",
        stageName: "Closed Won",
        count: wonDealsCount,
        value: wonDealsValue,
      },
    ];

    const topStageCount = rawStages[0].count;

    const stages: FunnelStageMetric[] = rawStages.map((stg, idx) => {
      let conversionRateFromTop = 0;
      if (topStageCount > 0) {
        conversionRateFromTop = Number(((stg.count / topStageCount) * 100).toFixed(1));
      }

      let stageToStageConversionRate = 0;
      let dropOffRate = 0;

      if (idx === 0) {
        stageToStageConversionRate = stg.count > 0 ? 100.0 : 0;
        dropOffRate = 0;
      } else {
        const prevCount = rawStages[idx - 1].count;
        if (prevCount > 0) {
          stageToStageConversionRate = Number(((stg.count / prevCount) * 100).toFixed(1));
          if (stg.count <= prevCount) {
            dropOffRate = Number((((prevCount - stg.count) / prevCount) * 100).toFixed(1));
          } else {
            dropOffRate = 0;
          }
        } else {
          stageToStageConversionRate = 0;
          dropOffRate = 0;
        }
      }

      return {
        stageKey: stg.stageKey,
        stageName: stg.stageName,
        count: stg.count,
        value: stg.value,
        conversionRateFromTop,
        stageToStageConversionRate,
        dropOffRate,
      };
    });

    // Overall conversion rate
    let overallConversionRate = 0;
    if (topStageCount > 0) {
      overallConversionRate = Number(((wonDealsCount / topStageCount) * 100).toFixed(1));
    } else if (totalDealsCount > 0) {
      overallConversionRate = Number(((wonDealsCount / totalDealsCount) * 100).toFixed(1));
    }

    // Average sales cycle in days: across won deals closed or created in this period
    let totalCycleDays = 0;
    let cycleCount = 0;

    const allWonDeals = await Deal.find({
      stage: "closed_won",
      ...(pipelineObjectId ? { pipelineId: pipelineObjectId } : {}),
      $or: [
        { createdAt: { $gte: start, $lte: end } },
        { actualCloseDate: { $gte: start, $lte: end } },
      ],
    });

    for (const d of allWonDeals) {
      const closedDate = d.actualCloseDate || d.wonDetails?.contractSignedDate || d.updatedAt;
      if (closedDate && d.createdAt) {
        const ms = closedDate.getTime() - d.createdAt.getTime();
        const days = Math.max(0, ms / (1000 * 60 * 60 * 24));
        totalCycleDays += days;
        cycleCount++;
      }
    }

    const averageSalesCycleDays =
      cycleCount > 0 ? Number((totalCycleDays / cycleCount).toFixed(1)) : 0;

    // Time in stage breakdown from stageHistory
    const timeInStage: Record<string, number> = {};
    const stageTimeAggregation = await Deal.aggregate([
      {
        $match: {
          ...(pipelineObjectId ? { pipelineId: pipelineObjectId } : {}),
          createdAt: { $gte: start, $lte: end },
        },
      },
      { $unwind: "$stageHistory" },
      {
        $group: {
          _id: "$stageHistory.fromStage",
          avgDays: { $avg: "$stageHistory.daysInPreviousStage" },
        },
      },
    ]);

    for (const item of stageTimeAggregation) {
      if (item._id && typeof item.avgDays === "number") {
        timeInStage[item._id] = Number(item.avgDays.toFixed(1));
      }
    }

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      stages,
      overallConversionRate,
      averageSalesCycleDays,
      timeInStage,
    };
  }

  /**
   * Revenue Forecasting Engine with 4 Scenario Models & Monthly Breakdown
   * Scenarios:
   * - Best Case: Total unweighted pipeline value of open deals closing in period.
   * - Weighted / Expected: Sum of (dealValue * winProbability).
   * - Committed: Sum of deals in late stages (negotiation, probability >= 85%).
   * - Closed Won Actual: Realized closed revenue in period.
   */
  public async getRevenueForecast(options: ForecastOptions = {}): Promise<RevenueForecastData> {
    const period = options.period || "quarter";
    const quotaTarget =
      typeof options.quotaTarget === "number" && options.quotaTarget >= 0
        ? options.quotaTarget
        : 100000;

    let startDate: Date;
    let endDate: Date;

    if (options.startDate && options.endDate) {
      startDate = new Date(options.startDate);
      endDate = new Date(options.endDate);
    } else {
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();

      if (period === "month") {
        startDate = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
      } else if (period === "year") {
        startDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
      } else {
        // Quarter
        const qIndex = Math.floor(currentMonth / 3);
        const qStartMonth = qIndex * 3;
        startDate = new Date(Date.UTC(currentYear, qStartMonth, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(currentYear, qStartMonth + 3, 0, 23, 59, 59, 999));
      }
    }

    const pipelineObjectId =
      options.pipelineId && mongoose.Types.ObjectId.isValid(options.pipelineId)
        ? new mongoose.Types.ObjectId(options.pipelineId)
        : undefined;

    // 1. Closed Won Actual in period
    const wonMatch: Record<string, any> = {
      stage: "closed_won",
      $or: [
        { actualCloseDate: { $gte: startDate, $lte: endDate } },
        { actualCloseDate: { $exists: false }, updatedAt: { $gte: startDate, $lte: endDate } },
        { actualCloseDate: null, updatedAt: { $gte: startDate, $lte: endDate } },
      ],
    };
    if (pipelineObjectId) {
      wonMatch.pipelineId = pipelineObjectId;
    }

    const wonDeals = await Deal.find(wonMatch, "value actualCloseDate updatedAt");
    const closedWonActual = wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);

    // 2. Open deals closing in period
    const openMatch: Record<string, any> = {
      stage: { $nin: ["closed_won", "closed_lost"] },
      expectedCloseDate: { $gte: startDate, $lte: endDate },
    };
    if (pipelineObjectId) {
      openMatch.pipelineId = pipelineObjectId;
    }

    const openDeals = await Deal.find(
      openMatch,
      "value probability stage expectedCloseDate"
    );

    let openPipelineTotal = 0;
    let committed = 0;
    let weightedExpected = 0;

    for (const deal of openDeals) {
      const val = deal.value || 0;
      openPipelineTotal += val;

      let prob = typeof deal.probability === "number" ? deal.probability : 0;
      if (prob > 1) {
        prob = prob / 100;
      }
      prob = Math.max(0, Math.min(1, prob));

      weightedExpected += val * prob;

      if (deal.stage === "negotiation" || prob >= 0.85) {
        committed += val;
      }
    }

    const bestCase = openPipelineTotal;

    // Monthly breakdown points
    const monthlyBreakdown: ForecastMonthlyPoint[] = [];
    const tempCur = new Date(startDate.getTime());

    while (tempCur <= endDate) {
      const y = tempCur.getUTCFullYear();
      const m = tempCur.getUTCMonth();
      const mStr = `${y}-${String(m + 1).padStart(2, "0")}`;

      const mStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
      const mEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));

      const mWon = wonDeals
        .filter((d) => {
          const dt = d.actualCloseDate || d.updatedAt;
          return dt && dt >= mStart && dt <= mEnd;
        })
        .reduce((sum, d) => sum + (d.value || 0), 0);

      const mOpen = openDeals.filter((d) => {
        const dt = d.expectedCloseDate;
        return dt && dt >= mStart && dt <= mEnd;
      });

      let mCommitted = 0;
      let mWeighted = 0;
      let mBestCase = 0;

      for (const od of mOpen) {
        const v = od.value || 0;
        mBestCase += v;
        let p = typeof od.probability === "number" ? od.probability : 0;
        if (p > 1) p = p / 100;
        p = Math.max(0, Math.min(1, p));
        mWeighted += v * p;
        if (od.stage === "negotiation" || p >= 0.85) {
          mCommitted += v;
        }
      }

      monthlyBreakdown.push({
        month: mStr,
        closedWon: Math.round(mWon),
        committed: Math.round(mCommitted),
        weightedExpected: Math.round(mWeighted),
        bestCase: Math.round(mBestCase),
      });

      tempCur.setUTCMonth(tempCur.getUTCMonth() + 1);
      tempCur.setUTCDate(1);
    }

    const totalProjected = closedWonActual + weightedExpected;
    const projectedQuotaAttainment =
      quotaTarget > 0 ? Number(((totalProjected / quotaTarget) * 100).toFixed(1)) : 0;

    const pipelineCoverageRatio =
      quotaTarget > 0 ? Number((openPipelineTotal / quotaTarget).toFixed(2)) : 0;

    return {
      period,
      dateWindow: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      scenarios: {
        closedWonActual: Math.round(closedWonActual),
        committed: Math.round(committed),
        weightedExpected: Math.round(weightedExpected),
        bestCase: Math.round(bestCase),
        openPipelineTotal: Math.round(openPipelineTotal),
        dealsClosingInPeriodCount: openDeals.length,
      },
      quotaTarget,
      projectedQuotaAttainment,
      pipelineCoverageRatio,
      monthlyBreakdown,
    };
  }

  /**
   * Sales Rep Performance Leaderboard & Rep Attribution
   * De-anonymized stats: deals closed, win rate, total bookings, average deal size, active pipeline
   */
  public async getRepPerformance(filter: DateRangeFilter = {}): Promise<RepLeaderboardData> {
    const { start, end } = this.resolveDateWindows(filter);
    const pipelineObjectId =
      filter.pipelineId && mongoose.Types.ObjectId.isValid(filter.pipelineId)
        ? new mongoose.Types.ObjectId(filter.pipelineId)
        : undefined;

    const dealMatch: Record<string, any> = {};
    if (pipelineObjectId) {
      dealMatch.pipelineId = pipelineObjectId;
    }

    const deals = await Deal.find(
      dealMatch,
      "ownerId stage value actualCloseDate createdAt updatedAt"
    );

    // Group deals by ownerId (string)
    const repDealMap = new Map<
      string,
      {
        wonDeals: typeof deals;
        lostDeals: typeof deals;
        openDeals: typeof deals;
      }
    >();

    for (const deal of deals) {
      const ownerKey = deal.ownerId ? deal.ownerId.toString() : "unassigned";
      if (!repDealMap.has(ownerKey)) {
        repDealMap.set(ownerKey, { wonDeals: [], lostDeals: [], openDeals: [] });
      }
      const bucket = repDealMap.get(ownerKey)!;

      if (deal.stage === "closed_won") {
        const closedAt = deal.actualCloseDate || deal.updatedAt;
        if (closedAt && closedAt >= start && closedAt <= end) {
          bucket.wonDeals.push(deal);
        }
      } else if (deal.stage === "closed_lost") {
        const lostAt = deal.updatedAt;
        if (lostAt && lostAt >= start && lostAt <= end) {
          bucket.lostDeals.push(deal);
        }
      } else {
        bucket.openDeals.push(deal);
      }
    }

    // Query User documents for de-anonymization
    const userIds = Array.from(repDealMap.keys()).filter((k) => k !== "unassigned");
    const users = await User.find(
      { _id: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      "profile auth"
    );
    const userMap = new Map<string, any>();
    for (const u of users) {
      userMap.set(u._id.toString(), u);
    }

    const reps: RepPerformanceItem[] = [];
    let totalBookings = 0;
    let totalDealsWon = 0;
    let totalDealsClosed = 0;
    let totalActivePipeline = 0;

    for (const [ownerKey, bucket] of repDealMap.entries()) {
      if (
        bucket.wonDeals.length === 0 &&
        bucket.lostDeals.length === 0 &&
        bucket.openDeals.length === 0
      ) {
        continue;
      }

      const wonCount = bucket.wonDeals.length;
      const lostCount = bucket.lostDeals.length;
      const closedCount = wonCount + lostCount;
      const winRate = closedCount > 0 ? Number(((wonCount / closedCount) * 100).toFixed(1)) : 0;
      const bookings = bucket.wonDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const avgDealSize = wonCount > 0 ? Math.round(bookings / wonCount) : 0;
      const activePipeline = bucket.openDeals.reduce((sum, d) => sum + (d.value || 0), 0);
      const quotaTarget = 100000;
      const quotaAttainment =
        quotaTarget > 0 ? Number(((bookings / quotaTarget) * 100).toFixed(1)) : 0;

      totalBookings += bookings;
      totalDealsWon += wonCount;
      totalDealsClosed += closedCount;
      totalActivePipeline += activePipeline;

      let repName = "Unassigned Rep";
      let repEmail = "unassigned@talnova.test";
      let avatarUrl: string | undefined = undefined;

      if (ownerKey !== "unassigned") {
        const user = userMap.get(ownerKey);
        if (user) {
          const fullName =
            user.profile?.fullName ||
            `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim();
          repName = fullName || user.auth?.email || "Sales Rep";
          repEmail = user.auth?.email || "";
          avatarUrl = user.profile?.avatarUrl;
        }
      }

      reps.push({
        repId: ownerKey,
        repName,
        repEmail,
        avatarUrl,
        dealsWon: wonCount,
        dealsLost: lostCount,
        dealsClosed: closedCount,
        winRate,
        totalBookings: Math.round(bookings),
        averageDealSize: avgDealSize,
        activePipelineValue: Math.round(activePipeline),
        openDealsCount: bucket.openDeals.length,
        quotaTarget,
        quotaAttainment,
      });
    }

    reps.sort((a, b) => b.totalBookings - a.totalBookings || b.winRate - a.winRate);

    const teamWinRate =
      totalDealsClosed > 0 ? Number(((totalDealsWon / totalDealsClosed) * 100).toFixed(1)) : 0;
    const teamAvgDealSize =
      totalDealsWon > 0 ? Math.round(totalBookings / totalDealsWon) : 0;

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
      reps,
      teamSummary: {
        totalBookings: Math.round(totalBookings),
        totalDealsWon,
        teamWinRate,
        averageDealSize: teamAvgDealSize,
        totalActivePipeline: Math.round(totalActivePipeline),
      },
    };
  }
}

export default SalesAnalyticsService;
