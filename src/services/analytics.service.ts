import { apiClient } from '../api/client';
import { AnalyticsSummary, ApiResponse } from '../types';

export interface TimeToCompletionMetrics {
  averageCompletionDays: number;
  fastestCompletionDays: number;
  slowestCompletionDays: number;
  totalCompletedAssignments: number;
}

export interface AnalyticsBottlenecks {
  moduleBottlenecks: Array<{
    moduleId: string;
    title: string;
    attempts: number;
    passRate: number;
    averageScore: number;
  }>;
  difficultQuestions: Array<{
    questionId: string;
    questionText: string;
    attempts: number;
    incorrectRate: number;
  }>;
}

export interface ScheduledReportItem {
  _id: string;
  title: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  format: 'csv' | 'json';
  status: 'active' | 'paused';
  createdAt: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  dropOff: number;
}

export interface ProductivityPoint {
  day: string;
  productivity: number;
}

export interface AnalyticsOverview {
  activeOnboarding: number;
  avgCompletionDays: number;
  retentionRate: number;
  completionRate: number;
  funnelStages: FunnelStage[];
  productivityCurve: ProductivityPoint[];
  department?: string | null;
  range?: string;
}

export const analyticsService = {
  getOverview: async (params?: { department?: string; range?: string }): Promise<AnalyticsOverview> => {
    const query = new URLSearchParams();
    if (params?.department && params.department !== 'All' && params.department !== 'all') {
      query.append('department', params.department);
    }
    if (params?.range) {
      query.append('range', params.range);
    }
    const qs = query.toString() ? `?${query.toString()}` : '';
    const response = await apiClient.get<ApiResponse<AnalyticsOverview>>(`/analytics/overview${qs}`);
    return response.data.data;
  },

  getAnalytics: async (range = '30d'): Promise<AnalyticsSummary> => {
    const response = await apiClient.get<ApiResponse<AnalyticsSummary>>(`/analytics/summary?range=${range}`);
    return response.data.data;
  },

  getTimeToCompletion: async (): Promise<TimeToCompletionMetrics> => {
    const response = await apiClient.get<ApiResponse<TimeToCompletionMetrics>>('/analytics/time-to-completion');
    return response.data.data;
  },

  getBottlenecks: async (): Promise<AnalyticsBottlenecks> => {
    const response = await apiClient.get<ApiResponse<AnalyticsBottlenecks>>('/analytics/bottlenecks');
    return response.data.data;
  },

  exportCSV: async (): Promise<string> => {
    const response = await apiClient.get<string>('/analytics/export', {
      responseType: 'text' as any,
    });
    return response.data;
  },

  getScheduledReports: async (): Promise<ScheduledReportItem[]> => {
    const response = await apiClient.get<ApiResponse<ScheduledReportItem[]>>('/analytics/scheduled-reports');
    return response.data.data || [];
  },

  createScheduledReport: async (data: {
    title: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    format?: 'csv' | 'json';
  }): Promise<ScheduledReportItem> => {
    const response = await apiClient.post<ApiResponse<ScheduledReportItem>>('/analytics/scheduled-reports', data);
    return response.data.data;
  },

  deleteScheduledReport: async (id: string): Promise<void> => {
    await apiClient.delete(`/analytics/scheduled-reports/${id}`);
  },
};

export default analyticsService;
