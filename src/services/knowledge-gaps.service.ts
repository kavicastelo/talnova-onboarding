import { apiClient } from '../api/client';

export interface KnowledgeGapItem {
  _id: string;
  organizationId: string;
  question: string;
  category?: string;
  occurrenceCount: number;
  requestedBy: Array<{
    _id: string;
    profile?: { firstName: string; lastName: string };
    auth?: { email: string };
  }>;
  status: 'unresolved' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  resolutionResourceId?: string;
  resolutionType?: 'quick_answer' | 'article';
  resolutionNotes?: string;
  resolvedBy?: {
    _id: string;
    profile?: { firstName: string; lastName: string };
  };
  resolvedAt?: string;
  lastAskedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeGapsResponse {
  success: boolean;
  data: KnowledgeGapItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const knowledgeGapsService = {
  async listGaps(params: { status?: string; page?: number; limit?: number } = {}): Promise<KnowledgeGapsResponse> {
    const res = await apiClient.get<KnowledgeGapsResponse>('/kb/gaps', { params });
    return res.data;
  },

  async resolveWithQuickAnswer(gapId: string, answer: string): Promise<KnowledgeGapItem> {
    const res = await apiClient.post<{ success: boolean; data: KnowledgeGapItem }>(`/kb/gaps/${gapId}/quick-answer`, { answer });
    return res.data.data;
  },

  async resolveWithArticle(gapId: string, articleId: string): Promise<KnowledgeGapItem> {
    const res = await apiClient.post<{ success: boolean; data: KnowledgeGapItem }>(`/kb/gaps/${gapId}/link-article`, { articleId });
    return res.data.data;
  },

  async dismissGap(gapId: string): Promise<KnowledgeGapItem> {
    const res = await apiClient.post<{ success: boolean; data: KnowledgeGapItem }>(`/kb/gaps/${gapId}/dismiss`);
    return res.data.data;
  },

  async triggerReindex(): Promise<{ articlesIndexed: number; totalChunksCreated: number }> {
    const res = await apiClient.post<{ success: boolean; data: { articlesIndexed: number; totalChunksCreated: number } }>('/kb/reindex');
    return res.data.data;
  },
};

export default knowledgeGapsService;
