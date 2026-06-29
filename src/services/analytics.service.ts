import { apiClient } from '../api/client';
import { AnalyticsSummary, ApiResponse } from '../types';

export const analyticsService = {
  getAnalytics: async (range = '30d'): Promise<AnalyticsSummary> => {
    const response = await apiClient.get<ApiResponse<AnalyticsSummary>>(`/analytics/summary?range=${range}`);
    return response.data.data;
  }
};
