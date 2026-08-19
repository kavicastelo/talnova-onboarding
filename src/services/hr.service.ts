import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface HRDashboardMetrics {
  totalEmployees: number;
  activeOnboardees: number;
  pausedOnboardees: number;
  journeyComplianceRate: number;
  pendingDocuments: number;
  overdueMilestones: number;
  unassignedBuddiesCount: number;
}

export interface HRExceptionItem {
  employee: {
    _id: string;
    name: string;
    email: string;
    department: string;
    jobTitle: string;
  };
  riskLevel: 'critical' | 'high' | 'medium';
  issues: string[];
}

export interface HRComplianceItem {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  onboardingState: string;
  totalAssigned: number;
  totalCompleted: number;
  completionRate: number;
}

export const hrService = {
  getDashboardMetrics: async (): Promise<HRDashboardMetrics> => {
    const response = await apiClient.get<ApiResponse<HRDashboardMetrics>>('/hr/dashboard');
    return response.data.data;
  },

  getExceptionQueue: async (): Promise<HRExceptionItem[]> => {
    const response = await apiClient.get<ApiResponse<HRExceptionItem[]>>('/hr/exceptions');
    return response.data.data || [];
  },

  updateLifecycleState: async (
    userId: string,
    state: 'active' | 'paused' | 'completed' | 'archived',
    reason?: string,
    extensionDays?: number
  ): Promise<any> => {
    const response = await apiClient.put<ApiResponse<any>>(`/hr/lifecycle/${userId}/state`, {
      state,
      reason,
      extensionDays,
    });
    return response.data.data;
  },

  executeBulkAction: async (
    action: 'assign_journey' | 'request_document' | 'send_reminder',
    employeeIds: string[],
    payload?: { journeyId?: string; templateId?: string; message?: string }
  ): Promise<{ processedCount: number }> => {
    const response = await apiClient.post<ApiResponse<{ processedCount: number }>>('/hr/bulk-action', {
      action,
      employeeIds,
      payload,
    });
    return response.data.data;
  },

  getComplianceReport: async (): Promise<HRComplianceItem[]> => {
    const response = await apiClient.get<ApiResponse<HRComplianceItem[]>>('/hr/compliance-report');
    return response.data.data || [];
  },
};

export default hrService;
