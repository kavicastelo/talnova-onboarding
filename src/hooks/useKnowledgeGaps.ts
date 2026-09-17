import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeGapsService } from '../services/knowledge-gaps.service';
import { toast } from 'sonner';

export const GAP_KEYS = {
  all: ['knowledgeGaps'] as const,
  list: (status?: string, page?: number) => [...GAP_KEYS.all, 'list', { status, page }] as const,
};

export function useKnowledgeGaps(status?: string, page?: number, limit?: number) {
  return useQuery({
    queryKey: GAP_KEYS.list(status, page),
    queryFn: () => knowledgeGapsService.listGaps({ status, page, limit }),
  });
}

export function useResolveGapWithQuickAnswer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gapId, answer }: { gapId: string; answer: string }) =>
      knowledgeGapsService.resolveWithQuickAnswer(gapId, answer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAP_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['kb'] });
      toast.success('Quick answer published and indexed for AI assistant!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to save quick answer');
    },
  });
}

export function useResolveGapWithArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gapId, articleId }: { gapId: string; articleId: string }) =>
      knowledgeGapsService.resolveWithArticle(gapId, articleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAP_KEYS.all });
      toast.success('Knowledge gap resolved with article!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to link article');
    },
  });
}

export function useDismissGap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (gapId: string) => knowledgeGapsService.dismissGap(gapId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GAP_KEYS.all });
      toast.success('Knowledge gap dismissed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to dismiss gap');
    },
  });
}

export function useTriggerReindex() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => knowledgeGapsService.triggerReindex(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['kb'] });
      toast.success(`Successfully re-indexed ${data.articlesIndexed} articles (${data.totalChunksCreated} chunks)!`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to re-index knowledge');
    },
  });
}
