import { useQuery } from '@tanstack/react-query';
import { knowledgeBaseService } from '../services/knowledgeBase.service';

export function useKbCategories() {
  return useQuery({
    queryKey: ['kbCategories'],
    queryFn: knowledgeBaseService.getCategories,
  });
}

export function useKbArticles(params?: { search?: string; category?: string }) {
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
