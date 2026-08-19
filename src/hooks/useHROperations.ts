import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import hrService from '../services/hr.service';

export function useHRDashboard() {
  return useQuery({
    queryKey: ['hrDashboardMetrics'],
    queryFn: () => hrService.getDashboardMetrics(),
  });
}

export function useHRExceptions() {
  return useQuery({
    queryKey: ['hrExceptionQueue'],
    queryFn: () => hrService.getExceptionQueue(),
  });
}

export function useHRComplianceReport() {
  return useQuery({
    queryKey: ['hrComplianceReport'],
    queryFn: () => hrService.getComplianceReport(),
  });
}

export function useUpdateLifecycleState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      state,
      reason,
      extensionDays,
    }: {
      userId: string;
      state: 'active' | 'paused' | 'completed' | 'archived';
      reason?: string;
      extensionDays?: number;
    }) => hrService.updateLifecycleState(userId, state, reason, extensionDays),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrDashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['hrExceptionQueue'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useExecuteHRBulkAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      employeeIds,
      payload,
    }: {
      action: 'assign_journey' | 'request_document' | 'send_reminder';
      employeeIds: string[];
      payload?: { journeyId?: string; templateId?: string; message?: string };
    }) => hrService.executeBulkAction(action, employeeIds, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hrDashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['hrExceptionQueue'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
