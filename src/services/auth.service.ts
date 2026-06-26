import { apiClient } from '../api/client';
import { User, ApiResponse } from '../types';

export const authService = {
  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    return response.data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  }
};
