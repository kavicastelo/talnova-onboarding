import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface MilestoneTemplate {
  _id: string;
  title: string;
  description?: string;
  targetDay: 30 | 60 | 90 | 180;
  goals: Array<{ _id?: string; title: string; description?: string }>;
  checkinQuestions: Array<{ _id?: string; question: string; type: 'text' | 'rating' | 'boolean'; required: boolean }>;
  createdAt: string;
}

export interface EmployeeMilestone {
  _id: string;
  templateId: string;
  employeeId: any;
  milestoneTitle: string;
  milestoneCode?: string;
  targetDay: 30 | 60 | 90 | 180;
  dueDate: string;
  status: 'pending' | 'in_review' | 'pending_manager_review' | 'completed' | 'approved' | 'revision_requested' | 'overdue';
  goalsProgress: Array<{
    goalTitle: string;
    completed: boolean;
    completedAt?: string;
  }>;
  employeeRating?: number;
  comments?: string;
  managerRating?: number;
  managerFeedback?: string;
  evaluatedAt?: string;
  employeeSelfCheck?: {
    completedAt?: string;
    responses: Array<{ questionId: string; question: string; answer: string }>;
    confidenceRating?: number;
    employeeRating?: number;
    comments?: string;
    reflectionNotes?: string;
  };
  managerReview?: {
    reviewedBy?: string;
    reviewedAt?: string;
    approvalStatus: 'pending' | 'approved' | 'needs_action' | 'revision_requested';
    performanceRating?: number;
    feedback?: string;
  };
}

export const milestoneService = {
  createTemplate: async (data: Partial<MilestoneTemplate>): Promise<MilestoneTemplate> => {
    const response = await apiClient.post<ApiResponse<MilestoneTemplate>>('/milestones/templates', data);
    return response.data.data;
  },

  listTemplates: async (): Promise<MilestoneTemplate[]> => {
    const response = await apiClient.get<ApiResponse<MilestoneTemplate[]>>('/milestones/templates');
    return response.data.data || [];
  },

  assignMilestone: async (templateId: string, employeeId: string): Promise<EmployeeMilestone> => {
    const response = await apiClient.post<ApiResponse<EmployeeMilestone>>('/milestones/assign', {
      templateId,
      employeeId,
    });
    return response.data.data;
  },

  getMyMilestones: async (): Promise<EmployeeMilestone[]> => {
    const response = await apiClient.get<ApiResponse<EmployeeMilestone[]>>('/milestones/my-milestones');
    return response.data.data || [];
  },

  getTeamMilestones: async (): Promise<EmployeeMilestone[]> => {
    const response = await apiClient.get<ApiResponse<EmployeeMilestone[]>>('/milestones/team-milestones');
    return response.data.data || [];
  },

  submitSelfCheckin: async (
    id: string,
    payload: {
      responses?: Array<{ questionId?: string; question?: string; answer?: string }>;
      confidenceRating?: number;
      employeeRating?: number;
      comments?: string;
      reflectionNotes?: string;
      goalsCompletedTitles?: string[];
    }
  ): Promise<EmployeeMilestone> => {
    const response = await apiClient.post<ApiResponse<EmployeeMilestone>>(`/milestones/${id}/self-evaluation`, payload);
    return response.data.data;
  },

  evaluateMilestone: async (
    id: string,
    payload: {
      status?: 'approved' | 'revision_requested' | 'needs_action';
      approvalStatus?: 'approved' | 'revision_requested' | 'needs_action';
      managerRating?: number;
      performanceRating?: number;
      managerFeedback?: string;
      feedback?: string;
    }
  ): Promise<EmployeeMilestone> => {
    const response = await apiClient.post<ApiResponse<EmployeeMilestone>>(`/milestones/${id}/evaluate`, payload);
    return response.data.data;
  },

  submitManagerReview: async (
    id: string,
    payload: {
      approvalStatus: 'approved' | 'needs_action' | 'revision_requested';
      performanceRating?: number;
      feedback?: string;
    }
  ): Promise<EmployeeMilestone> => {
    const response = await apiClient.post<ApiResponse<EmployeeMilestone>>(`/milestones/${id}/manager-review`, payload);
    return response.data.data;
  },
};

export default milestoneService;
