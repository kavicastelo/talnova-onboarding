import { apiClient } from '../api/client';
import { KbCategory, KbArticle, ApiResponse } from '../types';

const CATEGORY_MAP: Record<string, { id: string; description: string; icon: 'Shield' | 'Book' | 'FileText' | 'Users' | 'HelpCircle' }> = {
  'Company Policies': { id: '658c1f000000000000000001', description: 'Security, compliance, and legal guidelines.', icon: 'Shield' },
  'Employee Handbook': { id: '658c1f000000000000000002', description: 'Your guide to culture, perks, and working here.', icon: 'Book' },
  'Engineering Guidelines': { id: '658c1f000000000000000003', description: 'Coding standards, tools, and deployment processes.', icon: 'FileText' },
  'HR & People': { id: '658c1f000000000000000004', description: 'Benefits, time-off, and organizational chart.', icon: 'Users' }
};

const getCategoryNameById = (id?: string): string => {
  if (!id) return 'Company Policies';
  const entry = Object.entries(CATEGORY_MAP).find(([_, value]) => value.id === id);
  return entry ? entry[0] : 'Company Policies';
};

const getCategoryIdByName = (name?: string): string => {
  return CATEGORY_MAP[name || 'Company Policies']?.id || CATEGORY_MAP['Company Policies'].id;
};

const mapBackendArticleToKbArticle = (a: any): KbArticle => {
  return {
    id: a._id,
    title: a.title || '',
    category: getCategoryNameById(a.categoryId),
    content: a.content?.blocks?.map((b: any) => b.content).filter(Boolean).join('\n\n') || '',
    readTime: `${Math.ceil((a.analytics?.averageReadTimeSeconds || 120) / 60)} min read`
  };
};

export const knowledgeBaseService = {
  getCategories: async (): Promise<KbCategory[]> => {
    // Fetch all articles to compute live counts for each category
    const response = await apiClient.get<ApiResponse<any[]>>('/knowledge-base');
    const articles = response.data.data || [];
    
    return Object.entries(CATEGORY_MAP).map(([name, info]) => {
      const count = articles.filter((a: any) => getCategoryNameById(a.categoryId) === name).length;
      return {
        title: name,
        iconName: info.icon,
        count,
        description: info.description
      };
    });
  },


  getArticles: async (params?: { search?: string; category?: string }): Promise<KbArticle[]> => {
    const queryParams: Record<string, any> = {};
    if (params?.search) {
      queryParams.search = params.search;
    }
    if (params?.category) {
      queryParams.categoryId = getCategoryIdByName(params.category);
    }

    const response = await apiClient.get<ApiResponse<any[]>>('/knowledge-base', { params: queryParams });
    return (response.data.data || []).map(mapBackendArticleToKbArticle);
  },

  getArticle: async (id: string): Promise<KbArticle> => {
    const response = await apiClient.get<ApiResponse<any>>(`/knowledge-base/${id}`);
    return mapBackendArticleToKbArticle(response.data.data);
  }
};

