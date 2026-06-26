import { apiClient } from '../api/client';
import { KbCategory, KbArticle, ApiResponse } from '../types';

export const knowledgeBaseService = {
  getCategories: async (): Promise<KbCategory[]> => {
    const response = await apiClient.get<ApiResponse<KbCategory[]>>('/kb/categories');
    return response.data.data;
  },

  getArticles: async (params?: { search?: string; category?: string }): Promise<KbArticle[]> => {
    const response = await apiClient.get<ApiResponse<KbArticle[]>>('/kb/articles', { params });
    return response.data.data;
  },

  getArticle: async (id: string): Promise<KbArticle> => {
    const response = await apiClient.get<ApiResponse<KbArticle>>(`/kb/articles/${id}`);
    return response.data.data;
  }
};
