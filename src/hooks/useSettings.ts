import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services/settings.service';

export function useWorkspaceSettings() {
  return useQuery({
    queryKey: ['workspaceSettings'],
    queryFn: settingsService.getSettings,
  });
}

export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceSettings'] });
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: settingsService.getNotifications,
  });
}
