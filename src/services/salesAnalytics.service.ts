import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

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

export interface SalesOverviewMetricsData {
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
  category: 'stale_lead' | 'overdue_task' | 'closing_soon_deal' | 'failed_campaign';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  subtitle: string;
  urgencyReason: string;
  actionUrl: string;
  actionLabel: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export interface ActionCenterSummaryData {
  totalActionableCount: number;
  categoryCounts: {
    staleLeads: number;
    overdueTasks: number;
    closingSoonDeals: number;
    failedCampaigns: number;
  };
  items: ActionCenterItem[];
}

export interface OverviewMetricsFilter {
  startDate?: string;
  endDate?: string;
  pipelineId?: string;
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
  period?: 'month' | 'quarter' | 'year';
  startDate?: string;
  endDate?: string;
  pipelineId?: string;
  quotaTarget?: number;
}

export interface RevenueForecastData {
  period: 'month' | 'quarter' | 'year';
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

export const salesAnalyticsService = {
  /**
   * Fetch authoritative Sales Overview KPIs with period-over-period comparisons
   */
  async getOverviewMetrics(filter: OverviewMetricsFilter = {}): Promise<SalesOverviewMetricsData> {
    const res = await apiClient.get<ApiResponse<SalesOverviewMetricsData>>('/sales/analytics/overview', {
      params: filter,
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Fetch Action Center items requiring immediate operational resolution
   */
  async getActionCenter(limit = 10): Promise<ActionCenterSummaryData> {
    const res = await apiClient.get<ApiResponse<ActionCenterSummaryData>>('/sales/analytics/action-center', {
      params: { limit },
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Fetch multi-stage conversion funnel and cycle length metrics
   */
  async getFunnelMetrics(filter: OverviewMetricsFilter = {}): Promise<FunnelMetricsData> {
    const res = await apiClient.get<ApiResponse<FunnelMetricsData>>('/sales/analytics/funnel', {
      params: filter,
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Fetch revenue forecast scenarios and monthly breakdown
   */
  async getRevenueForecast(options: ForecastOptions = {}): Promise<RevenueForecastData> {
    const res = await apiClient.get<ApiResponse<RevenueForecastData>>('/sales/analytics/forecast', {
      params: options,
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Fetch sales rep leaderboard and performance metrics
   */
  async getRepPerformance(filter: OverviewMetricsFilter = {}): Promise<RepLeaderboardData> {
    const res = await apiClient.get<ApiResponse<RepLeaderboardData>>('/sales/analytics/rep-performance', {
      params: filter,
    });
    return (res.data as any).data || res.data;
  },
};

export default salesAnalyticsService;

