import { apiClient } from '../api/client';
import { AdminDashboardSummary, ApiResponse } from '../types';

export const dashboardService = {
  getDashboardSummary: async (): Promise<AdminDashboardSummary> => {
    const response = await apiClient.get<ApiResponse<AdminDashboardSummary>>('/dashboard/summary');
    return response.data.data;
  }
};
