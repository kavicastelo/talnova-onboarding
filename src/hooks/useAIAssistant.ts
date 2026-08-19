import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiService } from '../services/ai.service';

export function useAIConversations() {
  return useQuery({
    queryKey: ['aiConversations'],
    queryFn: () => aiService.getConversations(),
  });
}

export function useAIConversationById(id?: string) {
  return useQuery({
    queryKey: ['aiConversation', id],
    queryFn: () => (id ? aiService.getConversationById(id) : null),
    enabled: !!id,
  });
}

export function useAIChat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { message: string; conversationId?: string }) =>
      aiService.chat(data.message, data.conversationId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['aiConversations'] });
      queryClient.invalidateQueries({ queryKey: ['aiConversation', data._id] });
    },
  });
}

export function useAIFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { conversationId: string; messageId: string; rating: 'up' | 'down'; comment?: string }) =>
      aiService.logFeedback(data.conversationId, data.messageId, data.rating, data.comment),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['aiConversation', data._id] });
    },
  });
}
