import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeBaseService } from '../services/knowledgeBase.service';

export function useKbCategories() {
  return useQuery({
    queryKey: ['kbCategories'],
    queryFn: knowledgeBaseService.getCategories,
  });
}

export function useKbArticles(params?: { search?: string; category?: string; status?: string }) {
  return useQuery({
    queryKey: ['kbArticles', params],
    queryFn: () => knowledgeBaseService.getArticles(params),
  });
}

export function useKbArticle(id: string) {
  return useQuery({
    queryKey: ['kbArticle', id],
    queryFn: () => knowledgeBaseService.getArticle(id),
    enabled: !!id,
  });
}

export function useCreateKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.createArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbArticles'] });
      queryClient.invalidateQueries({ queryKey: ['kbCategories'] });
    },
  });
}

export function useUpdateKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      knowledgeBaseService.updateArticle(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['kbArticles'] });
      queryClient.invalidateQueries({ queryKey: ['kbArticle', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['kbCategories'] });
    },
  });
}

export function useDeleteKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.deleteArticle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kbArticles'] });
      queryClient.invalidateQueries({ queryKey: ['kbCategories'] });
    },
  });
}

export function usePublishKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.publishArticle,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['kbArticles'] });
      queryClient.invalidateQueries({ queryKey: ['kbArticle', id] });
      queryClient.invalidateQueries({ queryKey: ['kbCategories'] });
    },
  });
}

export function useArchiveKbArticle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.archiveArticle,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['kbArticles'] });
      queryClient.invalidateQueries({ queryKey: ['kbArticle', id] });
      queryClient.invalidateQueries({ queryKey: ['kbCategories'] });
    },
  });
}

// Quick Links hooks
export function useQuickLinks() {
  return useQuery({
    queryKey: ['quickLinks'],
    queryFn: knowledgeBaseService.getQuickLinks,
  });
}

export function useCreateQuickLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.createQuickLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickLinks'] });
    },
  });
}

export function useUpdateQuickLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      knowledgeBaseService.updateQuickLink(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickLinks'] });
    },
  });
}

export function useDeleteQuickLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: knowledgeBaseService.deleteQuickLink,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickLinks'] });
    },
  });
}
