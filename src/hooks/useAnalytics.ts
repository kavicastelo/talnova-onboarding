import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function useAnalytics(range = '30d') {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => analyticsService.getAnalytics(range),
  });
}

export function useTimeToCompletion() {
  return useQuery({
    queryKey: ['timeToCompletion'],
    queryFn: () => analyticsService.getTimeToCompletion(),
  });
}

export function useAnalyticsBottlenecks() {
  return useQuery({
    queryKey: ['analyticsBottlenecks'],
    queryFn: () => analyticsService.getBottlenecks(),
  });
}

export function useScheduledReports() {
  return useQuery({
    queryKey: ['scheduledReports'],
    queryFn: () => analyticsService.getScheduledReports(),
  });
}

export function useCreateScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; frequency: 'daily' | 'weekly' | 'monthly'; recipients: string[]; format?: 'csv' | 'json' }) =>
      analyticsService.createScheduledReport(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
  });
}

export function useDeleteScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsService.deleteScheduledReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
  });
}
