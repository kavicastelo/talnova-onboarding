import { apiClient } from '../api/client';
import { Journey, ApiResponse } from '../types';

const mapBackendModuleToCourseModule = (m: any): any => {
  return {
    id: m._id,
    title: m.title || '',
    lessons: (m.lessons || []).map((l: any) => {
      let type: 'Video' | 'Article' | 'Task' | 'Quiz' | 'PDF' | 'Document' | 'Audio' | 'Image' = 'Article';
      if (l.quiz) {
        type = 'Quiz';
      } else if (l.contentBlocks && l.contentBlocks.length > 0) {
        const blockTypes = l.contentBlocks.map((cb: any) => cb.type);
        if (blockTypes.includes('video')) {
          type = 'Video';
        } else if (blockTypes.includes('pdf') || l.contentBlocks.some((cb: any) => cb.content?.toLowerCase().includes('.pdf'))) {
          type = 'PDF';
        } else if (blockTypes.includes('document')) {
          type = 'Document';
        } else if (blockTypes.includes('audio')) {
          type = 'Audio';
        } else if (blockTypes.includes('image')) {
          type = 'Image';
        } else if (blockTypes.includes('checklist')) {
          type = 'Task';
        }
      } else if (l.description?.toLowerCase().includes('.pdf')) {
        type = 'PDF';
      }

      let completionRule: 'video' | 'button' | 'quiz' = 'button';
      if (l.completionRules?.requireQuizCompletion) {
        completionRule = 'quiz';
      } else if (l.completionRules?.requireContentCompletion && (type === 'Video' || type === 'Audio')) {
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
        completionRule,
        quiz: l.quiz ? {
          id: l.quiz._id || l.quiz.id,
          passingScore: l.quiz.passingScore || 80,
          questions: (l.quiz.questions || []).map((q: any) => ({
            id: q._id || q.id,
            questionText: q.question || '',
            type: q.type || 'single_choice',
            points: q.points || 1,
            options: (q.options || []).map((opt: any) => ({
              id: opt._id || opt.id,
              optionText: opt.text || '',
              isCorrect: opt.isCorrect ?? false
            }))
          }))
        } : null
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
              type: l.type === 'Video' ? 'video'
                  : l.type === 'PDF' ? 'pdf'
                  : l.type === 'Document' ? 'document'
                  : l.type === 'Audio' ? 'audio'
                  : l.type === 'Image' ? 'image'
                  : l.type === 'Task' ? 'checklist'
                  : (l.content?.toLowerCase().includes('.pdf') ? 'pdf' : 'text'),
              content: l.content || '',
              order: 0
            }
          ],
          quiz: l.type === 'Quiz' && l.quiz ? {
            title: l.title,
            passingScore: l.quiz.passingScore || 80,
            questions: (l.quiz.questions || []).map((q: any) => ({
              type: q.type || 'single_choice',
              question: q.questionText,
              points: q.points || 1,
              options: (q.options || []).map((opt: any) => ({
                text: opt.optionText,
                isCorrect: opt.isCorrect ?? false
              }))
            }))
          } : undefined,
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

  duplicateJourney: async (id: string, title: string): Promise<Journey> => {
    const response = await apiClient.post<ApiResponse<any>>(`/journeys/${id}/duplicate`, { title });
    return mapBackendJourneyToJourney(response.data.data);
  },

  assignJourney: async (journeyId: string, employeeId: string): Promise<void> => {
    await apiClient.post(`/assignments`, {
      employeeId,
      journeyId,
      priority: 'normal'
    });
  },

  bulkAssignJourneys: async (journeyId: string, employeeIds: string[]): Promise<{ assignedCount: number; skippedCount: number }> => {
    const response = await apiClient.post<ApiResponse<any>>('/assignments/bulk', {
      journeyId,
      employeeIds,
      priority: 'normal'
    });
    return response.data.data;
  },

  getJourneyAssignments: async (journeyId: string): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/assignments', {
      params: { journeyId }
    });
    return response.data.data || [];
  },

  issueCertificate: async (assignmentId: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/assignments/${assignmentId}/issue-certificate`);
    return response.data.data;
  },

  previewSmartAssignment: async (journeyId: string): Promise<{
    journeyId: string;
    journeyTitle: string;
    totalMatchingEmployees: number;
    alreadyAssignedCount: number;
    netNewEnrolleesCount: number;
    matchingEmployees: Array<{
      _id: string;
      fullName: string;
      email: string;
      department?: string;
      jobTitle?: string;
      location?: string;
      isAlreadyAssigned: boolean;
    }>;
  }> => {
    const response = await apiClient.post<ApiResponse<any>>(`/journeys/${journeyId}/assignment-preview`);
    return response.data.data;
  },

  executeSmartAssignment: async (journeyId: string, overrideDueDate?: string): Promise<{ assignedCount: number; skippedCount: number; message: string }> => {
    const response = await apiClient.post<ApiResponse<any>>(`/journeys/${journeyId}/smart-assign`, { overrideDueDate });
    return response.data.data;
  },

  updateTargeting: async (journeyId: string, targeting: any): Promise<Journey> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/journeys/${journeyId}/targeting`, targeting);
    return mapBackendJourneyToJourney(response.data.data);
  }
};

