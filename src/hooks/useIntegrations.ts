import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationService, HRISIntegrationData } from '../services/integration.service';

export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationService.getIntegrations(),
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<HRISIntegrationData>) => integrationService.createIntegration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useSyncIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationService.triggerSync(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrationLogs', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (id: string) => integrationService.testConnection(id),
  });
}

export function useIntegrationLogs(id?: string) {
  return useQuery({
    queryKey: ['integrationLogs', id],
    queryFn: () => (id ? integrationService.getSyncLogs(id) : []),
    enabled: !!id,
  });
}
