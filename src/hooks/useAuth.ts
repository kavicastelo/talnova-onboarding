import { useQuery } from '@tanstack/react-query';
import { authService } from '../services/auth.service';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: authService.getCurrentUser,
    retry: 1, // Only retry once for auth endpoint
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
