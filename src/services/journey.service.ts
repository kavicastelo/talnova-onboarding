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
    modules: (j.modules || []).map(mapBackendModuleToCourseModule),
    audience: {
      isPublic: j.audience?.isPublic || false
    },
    settings: j.settings ? {
      allowSkipLessons: j.settings.allowSkipLessons ?? false,
      requireSequentialCompletion: j.settings.requireSequentialCompletion ?? true,
      allowRetakes: j.settings.allowRetakes ?? true,
      maxRetakes: j.settings.maxRetakes ?? 3,
    } : undefined,
    certificate: j.certificate ? {
      enabled: j.certificate.enabled ?? false,
      templateId: j.certificate.templateId,
      passingScore: j.certificate.passingScore ?? 80,
    } : undefined
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
      .replace(/[^\w-]+/g, '') + '-' + Math.random().toString(36).substring(2, 6);

    const payload = {
      title: journey.title,
      description: journey.description || 'No description provided.',
      slug,
      tags: [],
      audience: {},
      settings: journey.settings || {
        allowSkipLessons: false,
        requireSequentialCompletion: true,
        allowRetakes: true,
        maxRetakes: 3
      },
      certificate: journey.certificate || {
        enabled: false,
        passingScore: 80
      }
    };

    const response = await apiClient.post<ApiResponse<any>>('/journeys', payload);
    return mapBackendJourneyToJourney(response.data.data);
  },

  updateJourney: async (id: string, journey: Partial<Journey>): Promise<Journey> => {
    const payload: Record<string, any> = {};
    if (journey.title !== undefined) payload.title = journey.title;
    if (journey.description !== undefined) payload.description = journey.description;
    if (journey.category !== undefined) payload.category = journey.category;
    if (journey.audience !== undefined) payload.audience = journey.audience;
    if (journey.settings !== undefined) payload.settings = journey.settings;
    if (journey.certificate !== undefined) payload.certificate = journey.certificate;
    
    if (journey.modules) {
      payload.modules = journey.modules.map((m, mIdx) => ({
        _id: m.id && m.id.length === 24 ? m.id : undefined,
        title: m.title,
        order: mIdx,
        lessons: (m.lessons || []).map((l, lIdx) => ({
          _id: l.id && l.id.length === 24 ? l.id : undefined,
          title: l.title,
          order: lIdx,
          estimatedDurationMinutes: l.estimatedTime || 5,
          description: l.description || '',
          contentBlocks: [
            {
              type: l.type === 'Video' ? 'video' : 'text',
              content: l.content || '',
              order: 0
            }
          ],
          completionRules: {
            requireContentCompletion: l.completionRule === 'video' || l.completionRule === 'button',
            requireQuizCompletion: l.completionRule === 'quiz'
          }
        }))
      }));
    }

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
  },

  getJourneyAssignments: async (journeyId: string): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/assignments', {
      params: { journeyId }
    });
    return response.data.data || [];
  }
};

