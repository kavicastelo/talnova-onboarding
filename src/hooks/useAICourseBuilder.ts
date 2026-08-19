import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiCourseService } from '../services/ai-course.service';

export function useCourseDrafts() {
  return useQuery({
    queryKey: ['aiCourseDrafts'],
    queryFn: () => aiCourseService.getDrafts(),
  });
}

export function useCourseDraftById(id?: string) {
  return useQuery({
    queryKey: ['aiCourseDraft', id],
    queryFn: () => (id ? aiCourseService.getDraftById(id) : null),
    enabled: !!id,
  });
}

export function useGenerateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { prompt: string; targetRole?: string; department?: string }) =>
      aiCourseService.generateDraft(data.prompt, data.targetRole, data.department),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiCourseDrafts'] });
    },
  });
}

export function useRegenerateModule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { draftId: string; moduleId: string }) =>
      aiCourseService.regenerateModule(data.draftId, data.moduleId),
    onSuccess: (updatedDraft) => {
      queryClient.invalidateQueries({ queryKey: ['aiCourseDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['aiCourseDraft', updatedDraft._id] });
    },
  });
}

export function usePublishCourseDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => aiCourseService.publishDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiCourseDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['journeys'] });
    },
  });
}

export function useDeleteCourseDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draftId: string) => aiCourseService.deleteDraft(draftId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiCourseDrafts'] });
    },
  });
}
