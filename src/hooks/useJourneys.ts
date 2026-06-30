import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { journeyService } from '../services/journey.service';
import { Journey } from '../types';

export function useJourneys() {
  return useQuery({
    queryKey: ['journeys'],
    queryFn: journeyService.getJourneys,
  });
}

export function useJourney(id: string) {
  return useQuery({
    queryKey: ['journey', id],
    queryFn: () => journeyService.getJourney(id),
    enabled: !!id,
  });
}

export function useCreateJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: journeyService.createJourney,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useUpdateJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, journey }: { id: string; journey: Partial<Journey> }) =>
      journeyService.updateJourney(id, journey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
      queryClient.invalidateQueries({ queryKey: ['journey', variables.id] });
    },
  });
}

export function useDeleteJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: journeyService.deleteJourney,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useAssignJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ journeyId, employeeId }: { journeyId: string; employeeId: string }) =>
      journeyService.assignJourney(journeyId, employeeId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['journeyAssignments', variables.journeyId] });
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useJourneyAssignments(journeyId: string) {
  return useQuery({
    queryKey: ['journeyAssignments', journeyId],
    queryFn: () => journeyService.getJourneyAssignments(journeyId),
    enabled: !!journeyId,
  });
}

export function useDuplicateJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      journeyService.duplicateJourney(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}
