import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import onboardingService, {
  IExceptionFilter,
  IResolutionRequest,
} from '../services/onboarding.service';

export function useOnboardingExceptions(filter?: IExceptionFilter, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['onboardingExceptions', filter],
    queryFn: () => onboardingService.getExceptions(filter),
    ...options,
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      caseId,
      resolution,
    }: {
      caseId: string;
      resolution: IResolutionRequest;
    }) => onboardingService.resolveException(caseId, resolution),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboardingExceptions'] });
      queryClient.invalidateQueries({ queryKey: ['hrDashboardMetrics'] });
      queryClient.invalidateQueries({ queryKey: ['hrExceptionQueue'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}
