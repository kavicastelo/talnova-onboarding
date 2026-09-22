import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface IRoleChecklistItem {
  _id?: string;
  title: string;
  description?: string;
  category: 'it_setup' | 'hr_paperwork' | 'equipment' | 'training' | 'general';
  stage: 'preboarding' | 'day_1' | 'week_1' | 'month_1' | 'custom';
  priority: 'low' | 'normal' | 'high' | 'critical';
  relativeOffsetDays: number;
  responsibleRole?: 'employee' | 'manager' | 'it_admin' | 'hr_admin' | 'buddy';
  requiresVerification: boolean;
  autoVerification?: {
    enabled: boolean;
    ruleType?: 'document_signed' | 'quiz_passed' | 'course_completed' | 'form_submitted';
    linkedEntityId?: string;
    entityModel?: 'DocumentTemplate' | 'Course' | 'Quiz';
    minScorePercent?: number;
  };
  prerequisiteItemIndex?: number;
}

export interface IRoleChecklistTemplate {
  _id: string;
  organizationId: string;
  title: string;
  description?: string;
  audience: {
    roles: Array<'owner' | 'admin' | 'manager' | 'employee' | 'hr_admin' | 'it_admin'>;
    departmentNames?: string[];
    jobTitleNames?: string[];
    employmentTypes?: Array<'full_time' | 'part_time' | 'contractor' | 'intern'>;
    locations?: string[];
    autoAssignNewHires: boolean;
  };
  items: IRoleChecklistItem[];
  isActive: boolean;
  createdBy?: {
    _id: string;
    auth?: { email: string };
    profile?: { firstName?: string; lastName?: string; fullName?: string };
  };
  createdAt: string;
  updatedAt: string;
}

export const taskTemplateService = {
  listTemplates: async (filters?: { role?: string; department?: string; isActive?: boolean }): Promise<IRoleChecklistTemplate[]> => {
    const response = await apiClient.get<ApiResponse<IRoleChecklistTemplate[]>>('/tasks/templates', { params: filters });
    return response.data?.data || [];
  },

  getTemplate: async (id: string): Promise<IRoleChecklistTemplate> => {
    const response = await apiClient.get<ApiResponse<IRoleChecklistTemplate>>(`/tasks/templates/${id}`);
    return response.data.data;
  },

  createTemplate: async (data: Partial<IRoleChecklistTemplate>): Promise<IRoleChecklistTemplate> => {
    const response = await apiClient.post<ApiResponse<IRoleChecklistTemplate>>('/tasks/templates', data);
    return response.data.data;
  },

  updateTemplate: async (id: string, data: Partial<IRoleChecklistTemplate>): Promise<IRoleChecklistTemplate> => {
    const response = await apiClient.patch<ApiResponse<IRoleChecklistTemplate>>(`/tasks/templates/${id}`, data);
    return response.data.data;
  },

  deleteTemplate: async (id: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`/tasks/templates/${id}`);
    return response.data;
  },

  applyTemplateToEmployee: async (
    templateId: string,
    employeeId: string,
    referenceDate?: string
  ): Promise<{ success: boolean; message: string; tasksCount: number }> => {
    const response = await apiClient.post<any>(`/tasks/templates/${templateId}/apply/${employeeId}`, {
      referenceDate,
    });
    return response.data;
  },
};

export default taskTemplateService;
