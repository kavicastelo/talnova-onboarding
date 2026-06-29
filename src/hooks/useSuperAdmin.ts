import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { superAdminService } from '../services/superAdmin.service';

export function useSuperAdminTelemetry() {
  return useQuery({
    queryKey: ['superAdminTelemetry'],
    queryFn: superAdminService.getTelemetry,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useSuperAdminActivityLogs() {
  return useQuery({
    queryKey: ['superAdminActivityLogs'],
    queryFn: superAdminService.getActivityLogs,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useSuperAdminOrganizations(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminOrganizations', params],
    queryFn: () => superAdminService.getOrganizations(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}

export function useToggleOrganizationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Active' | 'Suspended' }) =>
      superAdminService.toggleOrganizationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
    },
  });
}

export function useSuperAdminInvoices(params?: { search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminInvoices', params],
    queryFn: () => superAdminService.getInvoices(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
    },
  });
}
