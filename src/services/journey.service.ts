import { apiClient } from '../api/client';
import { Journey, ApiResponse } from '../types';

const mapBackendModuleToCourseModule = (m: any): any => {
  return {
    id: m._id,
    title: m.title || '',
    lessons: (m.lessons || []).map((l: any) => {
      let type: 'Video' | 'Article' | 'Task' | 'Quiz' = 'Article';
      if (l.quiz) {
        type = 'Quiz';
      } else if (l.contentBlocks?.some((cb: any) => cb.type === 'video')) {
        type = 'Video';
      }

      let completionRule: 'video' | 'button' | 'quiz' = 'button';
      if (l.completionRules?.requireQuizCompletion) {
        completionRule = 'quiz';
      } else if (l.completionRules?.requireContentCompletion && type === 'Video') {
        completionRule = 'video';
      }

      return {
        id: l._id,
        title: l.title || '',
        type,
        duration: `${l.estimatedDurationMinutes || 5} min`,
        isCompleted: false,
        content: l.contentBlocks?.map((cb: any) => cb.content).filter(Boolean).join('\n\n') || l.description || '',
        description: l.description || '',
        prerequisites: [],
        estimatedTime: l.estimatedDurationMinutes || 5,
        completionRule
      };
    })
  };
};

const mapBackendJourneyToJourney = (j: any): Journey => {
  let status: 'Active' | 'Draft' | 'Archived' = 'Draft';
  if (j.publishing?.status === 'published') status = 'Active';
  else if (j.publishing?.status === 'archived') status = 'Archived';

  return {
    id: j._id,
    title: j.title || '',
    status,
    enrolled: j.analytics?.totalAssignments || 0,
    completion: j.analytics?.completionRate || 0,
    lastUpdated: j.updatedAt ? new Date(j.updatedAt).toLocaleDateString() : '',
    description: j.description || '',
    category: j.category || 'General',
    modules: (j.modules || []).map(mapBackendModuleToCourseModule)
  };
};

export const journeyService = {
  getJourneys: async (): Promise<Journey[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/journeys');
    return (response.data.data || []).map(mapBackendJourneyToJourney);
  },

  getJourney: async (id: string): Promise<Journey> => {
    const response = await apiClient.get<ApiResponse<any>>(`/journeys/${id}`);
    return mapBackendJourneyToJourney(response.data.data);
  },

  createJourney: async (journey: Partial<Journey>): Promise<Journey> => {
    const slug = (journey.title || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '') + '-' + Math.random().toString(36).substring(2, 6);

    const payload = {
      title: journey.title,
      description: journey.description || 'No description provided.',
      slug,
      tags: [],
      audience: {}
    };

    const response = await apiClient.post<ApiResponse<any>>('/journeys', payload);
    return mapBackendJourneyToJourney(response.data.data);
  },

  updateJourney: async (id: string, journey: Partial<Journey>): Promise<Journey> => {
    const payload: Record<string, any> = {};
    if (journey.title) payload.title = journey.title;
    if (journey.description) payload.description = journey.description;
    if (journey.category) payload.category = journey.category;
    
    // Check if status change is requested
    if (journey.status) {
      if (journey.status === 'Active') {
        await apiClient.post(`/journeys/${id}/publish`);
      } else if (journey.status === 'Archived') {
        await apiClient.post(`/journeys/${id}/archive`);
      }
    }

    const response = await apiClient.patch<ApiResponse<any>>(`/journeys/${id}`, payload);
    return mapBackendJourneyToJourney(response.data.data);
  },

  deleteJourney: async (id: string): Promise<void> => {
    await apiClient.delete(`/journeys/${id}`);
  },

  assignJourney: async (journeyId: string, employeeId: string): Promise<void> => {
    await apiClient.post(`/assignments`, {
      employeeId,
      journeyId,
      priority: 'normal'
    });
  }
};

