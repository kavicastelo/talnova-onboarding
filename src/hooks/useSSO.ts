import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ssoService, SSOConfigData } from '../services/sso.service';

export function useSSOConfig() {
  return useQuery({
    queryKey: ['ssoConfig'],
    queryFn: () => ssoService.getConfig(),
  });
}

export function useSaveSSOConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SSOConfigData>) => ssoService.saveConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssoConfig'] });
    },
  });
}

export function useDiscoverSSO() {
  return useMutation({
    mutationFn: (email: string) => ssoService.discoverDomain(email),
  });
}
