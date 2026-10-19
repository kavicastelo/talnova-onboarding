import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export type CommChannel = 'email' | 'whatsapp';
export type CommDirection = 'inbound' | 'outbound';
export type CommMessageStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type CommThreadStatus = 'open' | 'pending' | 'resolved';

export interface ICommMessage {
  _id?: string;
  channel: CommChannel;
  direction: CommDirection;
  from: string;
  to: string[];
  subject?: string;
  body: string;
  status: CommMessageStatus;
  providerMessageId?: string;
  sentAt: string | Date;
  metadata?: Record<string, any>;
}

export interface ICommThread {
  _id: string;
  channel: CommChannel;
  leadId?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    email: string;
    phone?: string;
    companyName?: string;
    status?: string;
    leadScore?: number;
  };
  contactId?: {
    _id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone?: string;
    jobTitle?: string;
    role?: string;
  };
  companyId?: {
    _id: string;
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
  };
  dealId?: {
    _id: string;
    name: string;
    stage: string;
    value: number;
    currency: string;
  };
  status: CommThreadStatus;
  assignedTo?: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  subject?: string;
  lastMessageSnippet?: string;
  lastMessageAt: string | Date;
  messages: ICommMessage[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface InboxCounters {
  total: number;
  open: number;
  pending: number;
  resolved: number;
  unread: number;
}

export interface InboxPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InboxQueryParams {
  channel?: CommChannel;
  status?: CommThreadStatus;
  assignedTo?: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  unreadOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InboxListResponse {
  items: ICommThread[];
  pagination: InboxPagination;
  counters: InboxCounters;
}

export interface SendReplyPayload {
  body: string;
  subject?: string;
  to?: string;
  status?: CommThreadStatus;
}

export interface UpdateThreadPayload {
  status?: CommThreadStatus;
  assignedTo?: string | null;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
}

export interface CreateThreadPayload {
  channel: CommChannel;
  recipient: string;
  subject?: string;
  body: string;
  leadId?: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  assignedTo?: string;
}

export const salesInboxService = {
  /**
   * List threads with multi-channel filters, status, counters, and pagination
   */
  async listThreads(params?: InboxQueryParams): Promise<{
    items: ICommThread[];
    pagination: InboxPagination;
    counters: InboxCounters;
  }> {
    const response = await apiClient.get<any>('/sales/inbox', { params });
    const payload = response.data;

    return {
      items: payload.data || [],
      pagination: payload.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
      counters: payload.counters || { total: 0, open: 0, pending: 0, resolved: 0, unread: 0 },
    };
  },

  /**
   * Get thread by ID with full chronological message history
   */
  async getThreadById(id: string, options?: { markAsRead?: boolean }): Promise<ICommThread> {
    const query = options?.markAsRead ? '?markAsRead=true' : '';
    const response = await apiClient.get<ApiResponse<ICommThread>>(`/sales/inbox/${id}${query}`);
    return response.data.data;
  },

  /**
   * Send outbound reply message on existing thread
   */
  async sendReply(threadId: string, payload: SendReplyPayload): Promise<ICommThread> {
    const response = await apiClient.post<ApiResponse<ICommThread>>(
      `/sales/inbox/${threadId}/reply`,
      payload
    );
    return response.data.data;
  },

  /**
   * Update thread status, assignment, or linkages
   */
  async updateThread(threadId: string, payload: UpdateThreadPayload): Promise<ICommThread> {
    const response = await apiClient.patch<ApiResponse<ICommThread>>(
      `/sales/inbox/${threadId}`,
      payload
    );
    return response.data.data;
  },

  /**
   * Mark all unread messages in thread as read
   */
  async markThreadRead(threadId: string): Promise<ICommThread> {
    const response = await apiClient.post<ApiResponse<ICommThread>>(
      `/sales/inbox/${threadId}/read`,
      {}
    );
    return response.data.data;
  },

  /**
   * Initialize new outbound communication thread
   */
  async createThread(payload: CreateThreadPayload): Promise<ICommThread> {
    const response = await apiClient.post<ApiResponse<ICommThread>>('/sales/inbox', payload);
    return response.data.data;
  },
};

export default salesInboxService;
