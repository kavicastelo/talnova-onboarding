import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function useAnalytics(range = '30d') {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => analyticsService.getAnalytics(range),
  });
}
