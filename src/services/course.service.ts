import { apiClient } from '../api/client';
import { Course, ApiResponse, LessonType } from '../types';

export const courseService = {
  getCourse: async (id: string): Promise<Course> => {
    // 1. Fetch assignment progress
    const assignRes = await apiClient.get<ApiResponse<any>>(`/assignments/${id}`);
    const assignment = assignRes.data.data;

    // 2. Fetch original journey content
    const journeyRes = await apiClient.get<ApiResponse<any>>(`/journeys/${assignment.journey.journeyId}`);
    const journey = journeyRes.data.data;

    // 3. Map & Merge into Course structure
    const modules = journey.modules.map((m: any) => {
      // Find progress for this module in assignment
      const mProg = assignment.modules?.find((ap: any) => ap.moduleId === m._id);
      
      const lessons = m.lessons.map((l: any) => {
        // Find progress for this lesson in assignment
        const lProg = mProg?.lessons?.find((lp: any) => lp.lessonId === l._id);
        
        let type: LessonType = 'Article';
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
          title: l.title,
          type,
          duration: `${l.estimatedDurationMinutes || 5} min`,
          isCompleted: lProg?.status === 'completed',
          content: l.contentBlocks?.map((cb: any) => cb.content).filter(Boolean).join('\n\n') || l.description || '',
          description: l.description || '',
          prerequisites: [],
          estimatedTime: l.estimatedDurationMinutes || 5,
          completionRule
        };
      });

      return {
        id: m._id,
        title: m.title,
        lessons
      };
    });

    return {
      id: assignment._id,
      title: assignment.journey.title,
      progress: assignment.progress?.completionPercentage || 0,
      modules
    };
  },

  updateLessonCompletion: async (
    courseId: string,
    lessonId: string,
    _isCompleted: boolean
  ): Promise<Course> => {
    // 1. Fetch assignment and journey to resolve moduleId and completedBlockIds
    const assignRes = await apiClient.get<ApiResponse<any>>(`/assignments/${courseId}`);
    const assignment = assignRes.data.data;

    const journeyRes = await apiClient.get<ApiResponse<any>>(`/journeys/${assignment.journey.journeyId}`);
    const journey = journeyRes.data.data;

    let moduleId = '';
    let completedBlockIds: string[] = [];
    for (const m of journey.modules) {
      const lesson = m.lessons?.find((l: any) => l._id === lessonId);
      if (lesson) {
        moduleId = m._id;
        completedBlockIds = lesson.contentBlocks?.map((cb: any) => cb._id) || [];
        break;
      }
    }

    if (!moduleId) {
      throw new Error('Module/Lesson not found in journey');
    }

    // 2. Start the assignment if it's currently in "assigned" status
    if (assignment.status === 'assigned') {
      await apiClient.post(`/assignments/${courseId}/start`);
    }

    // 3. Dispatch lesson completion to backend
    await apiClient.post(`/assignments/${courseId}/complete-lesson`, {
      moduleId,
      lessonId,
      timeSpentSeconds: 120, // default time spent
      completedBlockIds
    });

    // 4. Return refreshed course details
    return courseService.getCourse(courseId);
  }
};

