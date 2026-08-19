import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface AICourseQuizQuestion {
  questionId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation?: string;
}

export interface AICourseLesson {
  lessonId: string;
  title: string;
  content: string;
  durationMinutes: number;
  quizQuestions: AICourseQuizQuestion[];
}

export interface AICourseModule {
  moduleId: string;
  title: string;
  description: string;
  lessons: AICourseLesson[];
}

export interface AICourseDraftData {
  _id: string;
  title: string;
  description: string;
  targetRole: string;
  department: string;
  status: 'draft' | 'approved' | 'published';
  modules: AICourseModule[];
  version: number;
  publishedJourneyId?: string;
  createdAt: string;
  updatedAt: string;
}

export const aiCourseService = {
  generateDraft: async (prompt: string, targetRole?: string, department?: string): Promise<AICourseDraftData> => {
    const response = await apiClient.post<ApiResponse<AICourseDraftData>>('/ai/course-builder/generate', {
      prompt,
      targetRole,
      department,
    });
    return response.data.data;
  },

  getDrafts: async (): Promise<AICourseDraftData[]> => {
    const response = await apiClient.get<ApiResponse<AICourseDraftData[]>>('/ai/course-builder/drafts');
    return response.data.data || [];
  },

  getDraftById: async (id: string): Promise<AICourseDraftData> => {
    const response = await apiClient.get<ApiResponse<AICourseDraftData>>(`/ai/course-builder/drafts/${id}`);
    return response.data.data;
  },

  regenerateModule: async (draftId: string, moduleId: string): Promise<AICourseDraftData> => {
    const response = await apiClient.post<ApiResponse<AICourseDraftData>>(
      `/ai/course-builder/drafts/${draftId}/regenerate-module`,
      { moduleId }
    );
    return response.data.data;
  },

  publishDraft: async (draftId: string): Promise<{ draft: AICourseDraftData; journey: any }> => {
    const response = await apiClient.post<ApiResponse<{ draft: AICourseDraftData; journey: any }>>(
      `/ai/course-builder/drafts/${draftId}/publish`
    );
    return response.data.data;
  },

  deleteDraft: async (draftId: string): Promise<void> => {
    await apiClient.delete(`/ai/course-builder/drafts/${draftId}`);
  },
};

export default aiCourseService;
