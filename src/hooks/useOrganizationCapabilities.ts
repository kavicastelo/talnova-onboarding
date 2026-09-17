import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import organizationIntegrationsService, {
  SaveIntegrationPayload,
  IntegrationData,
} from '../services/organization-integrations.service';

export const CAPABILITIES_QUERY_KEY = ['organization-capabilities'];
export const INTEGRATION_QUERY_KEY = (type: 'ai' | 'email') => ['organization-integration', type];

export function useOrganizationCapabilities() {
  const query = useQuery({
    queryKey: CAPABILITIES_QUERY_KEY,
    queryFn: organizationIntegrationsService.getCapabilities,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  return {
    capabilities: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isAIAvailable: query.data?.ai?.available ?? false,
    isEmailAvailable: query.data?.email?.available ?? false,
    aiStatus: query.data?.ai?.status ?? 'not_configured',
    emailStatus: query.data?.email?.status ?? 'not_configured',
    aiReason: query.data?.ai?.reason,
    emailReason: query.data?.email?.reason,
  };
}

export function useIntegrationConfig(type: 'ai' | 'email') {
  return useQuery({
    queryKey: INTEGRATION_QUERY_KEY(type),
    queryFn: () => organizationIntegrationsService.getIntegration(type),
  });
}

export function useSaveIntegration(type: 'ai' | 'email') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SaveIntegrationPayload) =>
      organizationIntegrationsService.saveIntegration(type, payload),
    onSuccess: (savedData: IntegrationData) => {
      queryClient.setQueryData(INTEGRATION_QUERY_KEY(type), savedData);
      queryClient.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });
    },
  });
}

export function useTestIntegration(type: 'ai' | 'email') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: {
      provider?: string;
      publicConfig?: Record<string, any>;
      secrets?: Record<string, any>;
      targetEmail?: string;
    }) => organizationIntegrationsService.testIntegration(type, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INTEGRATION_QUERY_KEY(type) });
      queryClient.invalidateQueries({ queryKey: CAPABILITIES_QUERY_KEY });
    },
  });
}
