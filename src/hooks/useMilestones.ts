import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import milestoneService, { MilestoneTemplate } from '../services/milestone.service';

export function useMilestoneTemplates() {
  return useQuery({
    queryKey: ['milestoneTemplates'],
    queryFn: () => milestoneService.listTemplates(),
  });
}

export function useMyMilestones() {
  return useQuery({
    queryKey: ['myMilestones'],
    queryFn: () => milestoneService.getMyMilestones(),
  });
}

export function useTeamMilestones() {
  return useQuery({
    queryKey: ['teamMilestones'],
    queryFn: () => milestoneService.getTeamMilestones(),
  });
}

export function useCreateMilestoneTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MilestoneTemplate>) => milestoneService.createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestoneTemplates'] });
    },
  });
}

export function useUpdateMilestoneTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MilestoneTemplate> }) =>
      milestoneService.updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestoneTemplates'] });
    },
  });
}

export function useDeleteMilestoneTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => milestoneService.deleteTemplate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestoneTemplates'] });
    },
  });
}

export function useAssignMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, employeeId }: { templateId: string; employeeId: string }) =>
      milestoneService.assignMilestone(templateId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
    },
  });
}

export function useSubmitSelfCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        responses?: Array<{ questionId?: string; question?: string; answer?: string }>;
        confidenceRating?: number;
        employeeRating?: number;
        comments?: string;
        reflectionNotes?: string;
        goalsCompletedTitles?: string[];
      };
    }) => milestoneService.submitSelfCheckin(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
    },
  });
}

export function useSubmitManagerReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        status?: 'approved' | 'revision_requested' | 'needs_action';
        approvalStatus?: 'approved' | 'revision_requested' | 'needs_action';
        managerRating?: number;
        performanceRating?: number;
        managerFeedback?: string;
        feedback?: string;
      };
    }) => milestoneService.evaluateMilestone(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
    },
  });
}

export function useMilestone(id?: string) {
  return useQuery({
    queryKey: ['milestone', id],
    queryFn: () => (id ? milestoneService.getMilestone(id) : null),
    enabled: Boolean(id),
  });
}

export function useUpdateMilestoneStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof milestoneService.updateMilestoneStatus>[1];
    }) => milestoneService.updateMilestoneStatus(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestone', variables.id] });
    },
  });
}

export function useUpdateMilestoneGoals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      goalsProgress,
    }: {
      id: string;
      goalsProgress: Array<{ goalTitle: string; completed: boolean }>;
    }) => milestoneService.updateMilestoneGoals(id, goalsProgress),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['milestone', variables.id] });
    },
  });
}

