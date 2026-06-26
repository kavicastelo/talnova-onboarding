import { apiClient } from '../api/client';
import { Course, ApiResponse } from '../types';

export const courseService = {
  getCourse: async (id: string): Promise<Course> => {
    const response = await apiClient.get<ApiResponse<Course>>(`/courses/${id}`);
    return response.data.data;
  },

  updateLessonCompletion: async (
    courseId: string,
    lessonId: string,
    isCompleted: boolean
  ): Promise<Course> => {
    const response = await apiClient.put<ApiResponse<Course>>(
      `/courses/${courseId}/lessons/${lessonId}`,
      { isCompleted }
    );
    return response.data.data;
  }
};
