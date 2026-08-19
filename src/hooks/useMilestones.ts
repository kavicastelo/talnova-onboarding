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
        responses: Array<{ questionId: string; question: string; answer: string }>;
        confidenceRating?: number;
        comments?: string;
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
        approvalStatus: 'approved' | 'needs_action';
        performanceRating?: number;
        feedback?: string;
      };
    }) => milestoneService.submitManagerReview(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamMilestones'] });
      queryClient.invalidateQueries({ queryKey: ['myMilestones'] });
    },
  });
}
