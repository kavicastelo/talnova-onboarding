import { apiClient } from '../api/client';
import { KbCategory, KbArticle, ApiResponse } from '../types';

export interface QuickLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  order: number;
}

export const CATEGORY_MAP: Record<string, { id: string; description: string; icon: 'Shield' | 'Book' | 'FileText' | 'Users' | 'HelpCircle' }> = {
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

const mapBackendArticleToKbArticle = (a: any): KbArticle & { summary?: string; blocks?: any[]; publishingStatus?: 'draft' | 'published' | 'archived'; tags?: string[]; views?: number } => {
  return {
    id: a._id,
    title: a.title || '',
    category: getCategoryNameById(a.categoryId),
    content: a.content?.blocks?.map((b: any) => b.content).filter(Boolean).join('\n\n') || '',
    readTime: `${Math.ceil((a.analytics?.averageReadTimeSeconds || 120) / 60)} min read`,
    summary: a.summary || '',
    blocks: a.content?.blocks || [],
    publishingStatus: a.publishing?.status || 'draft',
    tags: a.tags || [],
    views: a.analytics?.views || 0
  };
};

export const knowledgeBaseService = {
  getCategories: async (): Promise<KbCategory[]> => {
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

  getArticles: async (params?: { search?: string; category?: string; status?: string }): Promise<KbArticle[]> => {
    const queryParams: Record<string, any> = {};
    if (params?.search) {
      queryParams.search = params.search;
    }
    if (params?.category) {
      queryParams.categoryId = getCategoryIdByName(params.category);
    }
    if (params?.status) {
      queryParams.status = params.status;
    }

    const response = await apiClient.get<ApiResponse<any[]>>('/knowledge-base', { params: queryParams });
    return (response.data.data || []).map(mapBackendArticleToKbArticle);
  },

  getArticle: async (id: string): Promise<KbArticle> => {
    const response = await apiClient.get<ApiResponse<any>>(`/knowledge-base/${id}`);
    return mapBackendArticleToKbArticle(response.data.data);
  },

  createArticle: async (data: { title: string; summary?: string; category: string; contentBlocks: { type: string; content?: string }[]; tags?: string[] }): Promise<KbArticle> => {
    const body = {
      title: data.title,
      summary: data.summary,
      categoryId: getCategoryIdByName(data.category),
      content: {
        blocks: data.contentBlocks.map((b, i) => ({
          type: b.type,
          content: b.content,
          order: i
        }))
      },
      tags: data.tags || [],
      visibility: { access: 'all' }
    };
    const response = await apiClient.post<ApiResponse<any>>('/knowledge-base', body);
    return mapBackendArticleToKbArticle(response.data.data);
  },

  updateArticle: async (id: string, data: { title?: string; summary?: string; category?: string; contentBlocks?: { type: string; content?: string }[]; tags?: string[] }): Promise<KbArticle> => {
    const body: Record<string, any> = {};
    if (data.title !== undefined) body.title = data.title;
    if (data.summary !== undefined) body.summary = data.summary;
    if (data.category !== undefined) body.categoryId = getCategoryIdByName(data.category);
    if (data.contentBlocks !== undefined) {
      body.content = {
        blocks: data.contentBlocks.map((b, i) => ({
          type: b.type,
          content: b.content,
          order: i
        }))
      };
    }
    if (data.tags !== undefined) body.tags = data.tags;

    const response = await apiClient.patch<ApiResponse<any>>(`/knowledge-base/${id}`, body);
    return mapBackendArticleToKbArticle(response.data.data);
  },

  deleteArticle: async (id: string): Promise<void> => {
    await apiClient.delete(`/knowledge-base/${id}`);
  },

  publishArticle: async (id: string): Promise<KbArticle> => {
    const response = await apiClient.post<ApiResponse<any>>(`/knowledge-base/${id}/publish`);
    return mapBackendArticleToKbArticle(response.data.data);
  },

  archiveArticle: async (id: string): Promise<KbArticle> => {
    const response = await apiClient.post<ApiResponse<any>>(`/knowledge-base/${id}/archive`);
    return mapBackendArticleToKbArticle(response.data.data);
  },

  // Quick Links APIs
  getQuickLinks: async (): Promise<QuickLink[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/knowledge-base/quick-links');
    return (response.data.data || []).map((ql: any) => ({
      id: ql._id,
      title: ql.title,
      url: ql.url,
      icon: ql.icon,
      order: ql.order
    }));
  },

  createQuickLink: async (data: { title: string; url: string; icon?: string; order?: number }): Promise<QuickLink> => {
    const response = await apiClient.post<ApiResponse<any>>('/knowledge-base/quick-links', data);
    const ql = response.data.data;
    return {
      id: ql._id,
      title: ql.title,
      url: ql.url,
      icon: ql.icon,
      order: ql.order
    };
  },

  updateQuickLink: async (id: string, data: { title?: string; url?: string; icon?: string; order?: number }): Promise<QuickLink> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/knowledge-base/quick-links/${id}`, data);
    const ql = response.data.data;
    return {
      id: ql._id,
      title: ql.title,
      url: ql.url,
      icon: ql.icon,
      order: ql.order
    };
  },

  deleteQuickLink: async (id: string): Promise<void> => {
    await apiClient.delete(`/knowledge-base/quick-links/${id}`);
  }
};
