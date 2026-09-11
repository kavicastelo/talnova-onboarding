import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import buddyService, { BuddyProfile } from '../services/buddy.service';

export function useAvailableBuddies() {
  return useQuery({
    queryKey: ['availableBuddies'],
    queryFn: () => buddyService.listAvailableBuddies(),
  });
}

export function useMyBuddyProfile() {
  return useQuery({
    queryKey: ['myBuddyProfile'],
    queryFn: () => buddyService.getMyProfile(),
  });
}

export function useMyBuddy() {
  return useQuery({
    queryKey: ['myBuddy'],
    queryFn: () => buddyService.getEmployeeBuddy(),
  });
}

export function useMyMentees() {
  return useQuery({
    queryKey: ['myMentees'],
    queryFn: () => buddyService.getBuddyMentees(),
  });
}

export function useBuddyAssignments() {
  return useQuery({
    queryKey: ['buddyAssignments'],
    queryFn: () => buddyService.listAssignments(),
  });
}

export function useRegisterBuddy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BuddyProfile>) => buddyService.registerProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableBuddies'] });
      queryClient.invalidateQueries({ queryKey: ['myBuddyProfile'] });
    },
  });
}

export function useAssignBuddy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      newHireUserId,
      buddyUserId,
      checklistTemplate,
    }: {
      newHireUserId: string;
      buddyUserId: string;
      checklistTemplate?: string;
    }) => buddyService.assignBuddy(newHireUserId, buddyUserId, checklistTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBuddy'] });
      queryClient.invalidateQueries({ queryKey: ['myMentees'] });
      queryClient.invalidateQueries({ queryKey: ['availableBuddies'] });
      queryClient.invalidateQueries({ queryKey: ['buddyAssignments'] });
    },
  });
}

export function useUpdateBuddyChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId, taskId, completed }: { assignmentId: string; taskId: string; completed: boolean }) =>
      buddyService.updateChecklistTask(assignmentId, taskId, completed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBuddy'] });
      queryClient.invalidateQueries({ queryKey: ['myMentees'] });
    },
  });
}

export function useLogBuddyCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: { notes: string; rating?: number; sentiment?: 'positive' | 'neutral' | 'challenged' };
    }) => buddyService.logBuddyCheckin(assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBuddy'] });
      queryClient.invalidateQueries({ queryKey: ['myMentees'] });
      queryClient.invalidateQueries({ queryKey: ['buddyAssignments'] });
    },
  });
}

export function useAddBuddyChecklistTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      assignmentId,
      payload,
    }: {
      assignmentId: string;
      payload: { title: string; description?: string; stage?: string };
    }) => buddyService.addCustomChecklistTask(assignmentId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myBuddy'] });
      queryClient.invalidateQueries({ queryKey: ['myMentees'] });
      queryClient.invalidateQueries({ queryKey: ['buddyAssignments'] });
    },
  });
}
