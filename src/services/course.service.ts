import { apiClient } from '../api/client';
import { Course, ApiResponse, LessonType } from '../types';

export const courseService = {
  getCourse: async (id: string): Promise<Course> => {
    let assignment: any;
    try {
      // 1. Try fetching directly by assignment ID
      const assignRes = await apiClient.get<ApiResponse<any>>(`/assignments/${id}`);
      assignment = assignRes.data.data;
    } catch (err) {
      // If fetching directly by ID fails, it might be a journey ID.
      // Let's check if there's an assignment for this journey
      try {
        const listRes = await apiClient.get<ApiResponse<any[]>>('/assignments', {
          params: { journeyId: id }
        });
        const assignments = listRes.data.data || [];
        if (assignments.length > 0) {
          assignment = assignments[0];
        } else {
          // No assignment found. Auto-enroll the employee in this public journey!
          const meRes = await apiClient.get<ApiResponse<any>>('/employees/me');
          const employee = meRes.data.data;
          
          await apiClient.post('/assignments', {
            journeyId: id,
            employeeId: employee._id || employee.id,
            priority: 'normal'
          });
          
          // Fetch the newly created assignment
          const reListRes = await apiClient.get<ApiResponse<any[]>>('/assignments', {
            params: { journeyId: id }
          });
          const reAssignments = reListRes.data.data || [];
          if (reAssignments.length > 0) {
            assignment = reAssignments[0];
          } else {
            throw new Error('Failed to create and retrieve assignment.');
          }
        }
      } catch (innerErr) {
        console.error('Error resolving assignment for ID:', id, innerErr);
        throw err; // Throw the original error to trigger standard error UI
      }
    }

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

        const contentBlocksMapped = l.contentBlocks?.map((cb: any) => ({
          id: cb._id,
          type: cb.type === 'text' && cb.content?.toLowerCase().includes('.pdf') ? 'pdf' : cb.type,
          title: cb.title,
          content: cb.content,
          uploadUrl: cb.uploadId?.storage?.publicUrl || (typeof cb.uploadId === 'string' ? cb.uploadId : '') || cb.content || '',
          embedUrl: cb.embedUrl,
          order: cb.order,
        })) || [];

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
          completionRule,
          contentBlocks: contentBlocksMapped,
          quiz: l.quiz ? {
            id: l.quiz._id || l.quiz.id,
            passingScore: l.quiz.passingScore || 80,
            questions: (l.quiz.questions || []).map((q: any) => ({
              id: q._id || q.id,
              questionText: q.question || q.questionText || '',
              type: q.type || 'single_choice',
              points: q.points || 1,
              options: (q.options || []).map((o: any) => ({
                id: o._id || o.id,
                optionText: o.text || o.optionText || '',
                isCorrect: o.isCorrect ?? false,
              })),
            })),
          } : null,
          quizAttempt: lProg?.quizAttempt ? {
            score: lProg.quizAttempt.score,
            passed: lProg.quizAttempt.passed,
            attemptNumber: lProg.quizAttempt.attemptNumber,
          } : null,
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
  },

  submitQuiz: async (
    courseId: string,
    moduleId: string,
    lessonId: string,
    answers: Array<{ questionId: string; selectedOptions: string[] }>
  ): Promise<any> => {
    const assignRes = await apiClient.get<ApiResponse<any>>(`/assignments/${courseId}`);
    const assignment = assignRes.data.data;
    if (assignment.status === 'assigned') {
      await apiClient.post(`/assignments/${courseId}/start`);
    }

    const response = await apiClient.post<ApiResponse<any>>(`/assignments/${courseId}/submit-quiz`, {
      moduleId,
      lessonId,
      answers,
    });
    return response.data.data;
  }
};

