import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface CampaignStats {
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  repliedCount: number;
  failedCount: number;
}

export interface CampaignRecipient {
  _id?: string;
  contactId?: string;
  leadId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  status:
    | 'pending'
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'opened'
    | 'clicked'
    | 'bounced'
    | 'failed';
  providerMessageId?: string;
  sentAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
}

export interface CampaignItem {
  _id: string;
  name: string;
  description?: string;
  channel: 'email' | 'whatsapp';
  status:
    | 'draft'
    | 'validating'
    | 'scheduled'
    | 'queued'
    | 'sending'
    | 'completed'
    | 'paused'
    | 'cancelled'
    | 'failed';
  templateId?: any;
  subject?: string;
  previewText?: string;
  content?: string;
  whatsappTemplateName?: string;
  whatsappLanguageCode?: string;
  whatsappParameters?: Record<string, string>;
  audienceFilter?: Record<string, any>;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: any;
  stats: CampaignStats;
  recipients: CampaignRecipient[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CampaignTemplateItem {
  _id: string;
  name: string;
  channel: 'email' | 'whatsapp';
  subject?: string;
  previewText?: string;
  htmlContent?: string;
  plainTextContent?: string;
  whatsappTemplateName?: string;
  whatsappLanguageCode?: string;
  whatsappCategory?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  whatsappParameters?: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AudienceFilter {
  target?: 'leads' | 'contacts' | 'both';
  channel?: 'email' | 'whatsapp';
  statuses?: string[];
  minScore?: number;
  maxScore?: number;
  industries?: string[];
  companySizes?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  sources?: string[];
  country?: string;
  region?: string;
  inactiveDays?: number;
  roles?: string[];
  frequencyCap?: {
    maxMessages: number;
    windowDays: number;
  };
}

export interface AudienceEstimateResult {
  totalMatching: number;
  netDeliverable: number;
  suppressedCount: number;
  suppressionBreakdown: {
    no_consent?: number;
    opted_out?: number;
    suppressed?: number;
    historical_bounce?: number;
    frequency_capped?: number;
  };
  sampleRecipients: Array<{
    id: string;
    type: 'lead' | 'contact';
    name: string;
    email?: string;
    phone?: string;
    companyName?: string;
    score?: number;
    status?: string;
  }>;
}

export interface AudienceResolveResult {
  totalMatching: number;
  resolvedCount: number;
  recipients: Array<{
    contactId?: string;
    leadId?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientName?: string;
  }>;
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  channel: 'email' | 'whatsapp';
  templateId?: string;
  subject?: string;
  previewText?: string;
  content?: string;
  whatsappTemplateName?: string;
  whatsappLanguageCode?: string;
  whatsappParameters?: Record<string, string>;
  audienceFilter?: AudienceFilter;
  scheduledAt?: string | Date;
  tags?: string[];
  recipients?: Array<{
    contactId?: string;
    leadId?: string;
    recipientEmail?: string;
    recipientPhone?: string;
    recipientName?: string;
  }>;
}

export interface UpdateCampaignPayload extends Partial<CreateCampaignPayload> {}

export interface CampaignQueryParams {
  search?: string;
  channel?: 'email' | 'whatsapp';
  status?: string;
  tag?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'scheduledAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignLiveStatus {
  id: string;
  name: string;
  channel: 'email' | 'whatsapp';
  status: string;
  stats: CampaignStats;
  totalRecipients: number;
  processedCount: number;
  pendingCount: number;
  progressPercentage: number;
  startedAt?: string;
  completedAt?: string;
}

export const salesCampaignService = {
  // Campaign CRUD
  getCampaigns: async (
    params?: CampaignQueryParams
  ): Promise<{ items: CampaignItem[]; pagination: any }> => {
    const response = await apiClient.get<ApiResponse<CampaignItem[]> & { pagination: any }>(
      '/sales/campaigns',
      { params }
    );
    return {
      items: response.data.data,
      pagination: response.data.pagination || {
        total: response.data.data.length,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    };
  },

  getCampaignById: async (id: string): Promise<CampaignItem> => {
    const response = await apiClient.get<ApiResponse<CampaignItem>>(`/sales/campaigns/${id}`);
    return response.data.data;
  },

  createCampaign: async (payload: CreateCampaignPayload): Promise<CampaignItem> => {
    const response = await apiClient.post<ApiResponse<CampaignItem>>('/sales/campaigns', payload);
    return response.data.data;
  },

  updateCampaign: async (id: string, payload: UpdateCampaignPayload): Promise<CampaignItem> => {
    const response = await apiClient.patch<ApiResponse<CampaignItem>>(
      `/sales/campaigns/${id}`,
      payload
    );
    return response.data.data;
  },

  updateCampaignStatus: async (
    id: string,
    status: string,
    reason?: string
  ): Promise<CampaignItem> => {
    const response = await apiClient.patch<ApiResponse<CampaignItem>>(
      `/sales/campaigns/${id}/status`,
      { status, reason }
    );
    return response.data.data;
  },

  deleteCampaign: async (id: string): Promise<{ success: boolean; id: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; id: string }>>(
      `/sales/campaigns/${id}`
    );
    return response.data.data;
  },

  cloneCampaign: async (
    id: string,
    payload?: { name?: string; includeRecipients?: boolean }
  ): Promise<CampaignItem> => {
    const response = await apiClient.post<ApiResponse<CampaignItem>>(
      `/sales/campaigns/${id}/clone`,
      payload || {}
    );
    return response.data.data;
  },

  addRecipients: async (id: string, recipients: any[]): Promise<CampaignItem> => {
    const response = await apiClient.post<ApiResponse<CampaignItem>>(
      `/sales/campaigns/${id}/recipients`,
      { recipients }
    );
    return response.data.data;
  },

  // Execution & Dispatch Controls
  launchCampaign: async (
    id: string,
    options?: { batchSize?: number; rateLimitPerSecond?: number }
  ): Promise<{ success: boolean; message: string; campaign: CampaignItem }> => {
    const response = await apiClient.post<
      ApiResponse<{ success: boolean; message: string; campaign: CampaignItem }>
    >(`/sales/campaigns/${id}/launch`, options || {});
    return response.data.data;
  },

  pauseCampaign: async (id: string): Promise<{ success: boolean; campaign: CampaignItem }> => {
    const response = await apiClient.post<
      ApiResponse<{ success: boolean; campaign: CampaignItem }>
    >(`/sales/campaigns/${id}/pause`);
    return response.data.data;
  },

  resumeCampaign: async (id: string): Promise<{ success: boolean; campaign: CampaignItem }> => {
    const response = await apiClient.post<
      ApiResponse<{ success: boolean; campaign: CampaignItem }>
    >(`/sales/campaigns/${id}/resume`);
    return response.data.data;
  },

  cancelCampaign: async (id: string): Promise<{ success: boolean; campaign: CampaignItem }> => {
    const response = await apiClient.post<
      ApiResponse<{ success: boolean; campaign: CampaignItem }>
    >(`/sales/campaigns/${id}/cancel`);
    return response.data.data;
  },

  getLiveStatus: async (id: string): Promise<CampaignLiveStatus> => {
    const response = await apiClient.get<ApiResponse<CampaignLiveStatus>>(
      `/sales/campaigns/${id}/status-live`
    );
    return response.data.data;
  },

  // Templates API
  getTemplates: async (params?: {
    channel?: 'email' | 'whatsapp';
    search?: string;
  }): Promise<CampaignTemplateItem[]> => {
    const response = await apiClient.get<ApiResponse<CampaignTemplateItem[]>>(
      '/sales/campaigns/templates',
      { params }
    );
    return response.data.data;
  },

  getTemplateById: async (id: string): Promise<CampaignTemplateItem> => {
    const response = await apiClient.get<ApiResponse<CampaignTemplateItem>>(
      `/sales/campaigns/templates/${id}`
    );
    return response.data.data;
  },

  createTemplate: async (payload: any): Promise<CampaignTemplateItem> => {
    const response = await apiClient.post<ApiResponse<CampaignTemplateItem>>(
      '/sales/campaigns/templates',
      payload
    );
    return response.data.data;
  },

  previewTemplate: async (payload: {
    templateId?: string;
    subject?: string;
    htmlContent?: string;
    plainTextContent?: string;
    sampleVariables?: Record<string, any>;
    defaultFallback?: string;
  }): Promise<{ subject: string; html: string; text: string; missingVariables: string[] }> => {
    const response = await apiClient.post<
      ApiResponse<{ subject: string; html: string; text: string; missingVariables: string[] }>
    >('/sales/campaigns/templates/preview', payload);
    return response.data.data;
  },

  // Audience Segmentation & Suppression Engine
  estimateAudience: async (
    filter: AudienceFilter,
    sampleSize = 5
  ): Promise<AudienceEstimateResult> => {
    const response = await apiClient.post<ApiResponse<AudienceEstimateResult>>(
      '/sales/campaigns/audience/estimate',
      { filter, sampleSize }
    );
    return response.data.data;
  },

  resolveAudience: async (
    filter: AudienceFilter,
    limit?: number
  ): Promise<AudienceResolveResult> => {
    const response = await apiClient.post<ApiResponse<AudienceResolveResult>>(
      '/sales/campaigns/audience/resolve',
      { filter, limit }
    );
    return response.data.data;
  },
};

export default salesCampaignService;
