import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface RescuePlaybook {
  targetStakeholder: string;
  recommendedStrategy: string;
  talkingPoints: string[];
  fallbackOffer?: string;
}

export interface DealRiskOverviewItem {
  _id: string;
  name: string;
  companyName?: string;
  value: number;
  currency: string;
  stage: string;
  healthScore: number;
  riskFlags: string[];
  daysInCurrentStage: number;
  latestInsight?: {
    summary: string;
    detectedObjections: string[];
    rescuePlaybook?: RescuePlaybook;
  };
}

export interface LeadRecommendationItem {
  _id: string;
  name: string;
  companyName: string;
  email: string;
  phone?: string;
  score: number;
  priority: string;
  status: string;
  intentBadge: string;
  recommendedAction: string;
  latestInsight?: {
    title: string;
    summary: string;
    confidence?: number;
  };
}

export interface AIInsightItem {
  _id: string;
  targetType: 'lead' | 'deal' | 'campaign' | 'general';
  targetId?: string;
  insightType: string;
  title: string;
  summary: string;
  recommendedAction?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'reviewed' | 'accepted' | 'dismissed';
  confidence?: number;
  createdAt: string;
}

export interface AISalesStats {
  highRiskDealsCount: number;
  atRiskPipelineValue: number;
  highIntentLeadsCount: number;
  activeInsightsCount: number;
  totalDealsAnalyzed: number;
  totalLeadsAnalyzed: number;
}

export interface AISalesOverviewData {
  configured: boolean;
  provider: string | null;
  stats: AISalesStats;
  topRiskDeals: DealRiskOverviewItem[];
  topIntentLeads: LeadRecommendationItem[];
  recentInsights: AIInsightItem[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  provider?: string;
}

export interface ChatResponseData {
  reply: string;
  provider: string;
  timestamp: string;
  contextualMetrics?: {
    openDealsCount: number;
    openPipelineValue: number;
    atRiskDealsCount: number;
    atRiskPipelineValue: number;
    activeLeadsCount: number;
  };
}

export const salesAiService = {
  /**
   * Fetch AI Sales Overview metrics, risk alerts, and lead recommendations
   */
  async getOverview(simulateOffline = false): Promise<AISalesOverviewData> {
    const res = await apiClient.get<ApiResponse<AISalesOverviewData>>('/sales/ai/overview', {
      params: simulateOffline ? { simulateOffline: 'true' } : {},
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Send query to sales data AI co-pilot
   */
  async chatWithSalesData(
    message: string,
    history: ChatMessage[] = []
  ): Promise<ChatResponseData> {
    const res = await apiClient.post<ApiResponse<ChatResponseData>>('/sales/ai/chat', {
      message,
      history: history.map((h) => ({ role: h.role, content: h.content })),
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Run or refresh deal risk and objection analysis
   */
  async analyzeDealRisk(dealId: string, forceRefresh = false): Promise<any> {
    const res = await apiClient.post(`/sales/ai/deals/${dealId}/analyze-risk`, {
      forceRefresh,
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Run or refresh lead executive summary & next actions
   */
  async summarizeLead(leadId: string, forceRefresh = false): Promise<any> {
    const res = await apiClient.post(`/sales/ai/leads/${leadId}/summarize`, {
      forceRefresh,
    });
    return (res.data as any).data || res.data;
  },

  /**
   * Update insight approval/review status
   */
  async updateInsightStatus(
    insightId: string,
    status: 'reviewed' | 'accepted' | 'dismissed'
  ): Promise<any> {
    const res = await apiClient.patch(`/sales/ai/insights/${insightId}/status`, {
      status,
    });
    return (res.data as any).data || res.data;
  },
};

export default salesAiService;
