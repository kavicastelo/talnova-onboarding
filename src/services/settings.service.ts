import { apiClient } from '../api/client';
import { WorkspaceSettings, ApiResponse, AppNotification } from '../types';

export const settingsService = {
  getSettings: async (): Promise<WorkspaceSettings> => {
    const response = await apiClient.get<ApiResponse<WorkspaceSettings>>('/settings');
    return response.data.data;
  },

  updateSettings: async (settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> => {
    const response = await apiClient.put<ApiResponse<WorkspaceSettings>>('/settings', settings);
    return response.data.data;
  },

  getNotifications: async (): Promise<AppNotification[]> => {
    const response = await apiClient.get<ApiResponse<AppNotification[]>>('/notifications');
    return response.data.data;
  }
};
