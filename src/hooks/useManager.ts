import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import managerService from '../services/manager.service';

export function useManagerDashboard() {
  return useQuery({
    queryKey: ['managerDashboard'],
    queryFn: () => managerService.getDashboard(),
  });
}

export function useTeamDirectReports() {
  return useQuery({
    queryKey: ['teamDirectReports'],
    queryFn: () => managerService.getTeam(),
  });
}

export function useDirectReportDetails(employeeId: string | null) {
  return useQuery({
    queryKey: ['directReportDetails', employeeId],
    queryFn: () => managerService.getDirectReportDetails(employeeId!),
    enabled: !!employeeId,
  });
}

export function useNudgeDirectReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, message }: { employeeId: string; message?: string }) =>
      managerService.nudgeDirectReport(employeeId, message),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teamDirectReports'] });
      queryClient.invalidateQueries({ queryKey: ['managerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['directReportDetails', variables.employeeId] });
    },
  });
}

export function useSignOffDirectReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, notes }: { employeeId: string; notes?: string }) =>
      managerService.signOffDirectReport(employeeId, notes),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teamDirectReports'] });
      queryClient.invalidateQueries({ queryKey: ['managerDashboard'] });
      queryClient.invalidateQueries({ queryKey: ['directReportDetails', variables.employeeId] });
    },
  });
}
