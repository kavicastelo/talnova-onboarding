import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { courseService } from '../services/course.service';

export function useCourse(id: string) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => courseService.getCourse(id),
    enabled: !!id,
  });
}

export function useUpdateLessonCompletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      lessonId,
      isCompleted,
    }: {
      courseId: string;
      lessonId: string;
      isCompleted: boolean;
    }) => courseService.updateLessonCompletion(courseId, lessonId, isCompleted),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course', variables.courseId] });
    },
  });
}

export function useSubmitQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      courseId,
      moduleId,
      lessonId,
      answers,
    }: {
      courseId: string;
      moduleId: string;
      lessonId: string;
      answers: Array<{ questionId: string; selectedOptions: string[] }>;
    }) => courseService.submitQuiz(courseId, moduleId, lessonId, answers),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['course', variables.courseId] });
    },
  });
}
