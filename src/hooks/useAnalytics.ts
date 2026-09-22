import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics.service';

export function useAnalyticsOverview(params?: { department?: string; range?: string }) {
  return useQuery({
    queryKey: ['analyticsOverview', params?.department, params?.range],
    queryFn: () => analyticsService.getOverview(params),
  });
}

export function useAnalytics(range = '30d') {
  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => analyticsService.getAnalytics(range),
  });
}

export function useTimeToCompletion(params?: { department?: string }) {
  return useQuery({
    queryKey: ['timeToCompletion', params?.department],
    queryFn: () => analyticsService.getTimeToCompletion(params),
  });
}

export function useAnalyticsBottlenecks(params?: { department?: string }) {
  return useQuery({
    queryKey: ['analyticsBottlenecks', params?.department],
    queryFn: () => analyticsService.getBottlenecks(params),
  });
}

export function useCohortHealth(params?: { department?: string }) {
  return useQuery({
    queryKey: ['cohortHealth', params?.department],
    queryFn: () => analyticsService.getCohortHealth(params),
  });
}

export function useNudgeEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (employeeId: string) => analyticsService.nudgeEmployee(employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cohortHealth'] });
      queryClient.invalidateQueries({ queryKey: ['analyticsOverview'] });
    },
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

export function useRunScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => analyticsService.runScheduledReport(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledReports'] });
    },
  });
}
