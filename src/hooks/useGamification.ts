import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { gamificationService } from '../services/gamification.service';

export function useGamificationProfile() {
  return useQuery({
    queryKey: ['gamificationProfile'],
    queryFn: () => gamificationService.getProfile(),
  });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => gamificationService.getLeaderboard(),
  });
}

export function useAwardPoints() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { action: string; points: number; description: string }) =>
      gamificationService.awardPoints(data.action, data.points, data.description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gamificationProfile'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
