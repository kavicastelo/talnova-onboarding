import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface AICitation {
  title: string;
  url: string;
  articleId?: string;
}

export interface AIActionSuggestion {
  text: string;
  action: string;
}

export interface AIMessage {
  _id?: string;
  sender: 'user' | 'assistant';
  content: string;
  citations?: AICitation[];
  actionSuggestions?: AIActionSuggestion[];
  timestamp: string;
}

export interface AIFeedback {
  messageId: string;
  rating: 'up' | 'down';
  comment?: string;
  timestamp: string;
}

export interface AIConversationData {
  _id: string;
  title: string;
  messages: AIMessage[];
  feedback: AIFeedback[];
  createdAt: string;
  updatedAt: string;
}

export const aiService = {
  chat: async (message: string, conversationId?: string): Promise<AIConversationData> => {
    const response = await apiClient.post<ApiResponse<AIConversationData>>('/ai/chat', {
      message,
      conversationId,
    });
    return response.data.data;
  },

  getConversations: async (): Promise<AIConversationData[]> => {
    const response = await apiClient.get<ApiResponse<AIConversationData[]>>('/ai/conversations');
    return response.data.data || [];
  },

  getConversationById: async (id: string): Promise<AIConversationData> => {
    const response = await apiClient.get<ApiResponse<AIConversationData>>(`/ai/conversations/${id}`);
    return response.data.data;
  },

  logFeedback: async (
    conversationId: string,
    messageId: string,
    rating: 'up' | 'down',
    comment?: string
  ): Promise<AIConversationData> => {
    const response = await apiClient.post<ApiResponse<AIConversationData>>('/ai/feedback', {
      conversationId,
      messageId,
      rating,
      comment,
    });
    return response.data.data;
  },
};

export default aiService;
