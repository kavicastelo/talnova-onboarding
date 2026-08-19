import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface ManagerDashboardMetrics {
  totalDirectReports: number;
  activeOnboardingCount: number;
  overallCompletionRate: number;
  overdueItemsCount: number;
  recentActivities: Array<{
    id: string;
    employeeName: string;
    type: 'journey_completed' | 'task_completed' | 'nudge_sent' | 'signed_off';
    title: string;
    timestamp: string;
  }>;
}

export interface DirectReportSummary {
  _id: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  location?: string;
  hireDate?: string;
  status: string;
  journeyStats: {
    totalAssigned: number;
    completed: number;
    inProgress: number;
    completionPercentage: number;
  };
  taskStats: {
    totalAssigned: number;
    completed: number;
    overdue: number;
  };
  hasOverdueItems: boolean;
  signedOffAt?: string;
}

export interface DirectReportDetails {
  employee: {
    _id: string;
    fullName: string;
    email: string;
    jobTitle?: string;
    department?: string;
    hireDate?: string;
    status: string;
  };
  assignments: Array<{
    _id: string;
    journeyTitle: string;
    journeyVersion: number;
    status: string;
    dueDate?: string;
    assignedAt: string;
    progress: {
      completionPercentage: number;
      completedLessons: number;
      totalLessons: number;
    };
  }>;
  tasks: Array<{
    _id: string;
    title: string;
    description?: string;
    category?: string;
    status: string;
    dueDate?: string;
    priority: string;
  }>;
}

export const managerService = {
  getDashboard: async (): Promise<ManagerDashboardMetrics> => {
    const response = await apiClient.get<ApiResponse<ManagerDashboardMetrics>>('/manager/dashboard');
    return response.data.data;
  },

  getTeam: async (): Promise<DirectReportSummary[]> => {
    const response = await apiClient.get<ApiResponse<DirectReportSummary[]>>('/manager/team');
    return response.data.data || [];
  },

  getDirectReportDetails: async (employeeId: string): Promise<DirectReportDetails> => {
    const response = await apiClient.get<ApiResponse<DirectReportDetails>>(`/manager/team/${employeeId}`);
    return response.data.data;
  },

  nudgeDirectReport: async (employeeId: string, message?: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<ApiResponse<any>>(`/manager/team/${employeeId}/nudge`, { message });
    return response.data.data;
  },

  signOffDirectReport: async (employeeId: string, notes?: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<ApiResponse<any>>(`/manager/team/${employeeId}/sign-off`, { notes });
    return response.data.data;
  }
};

export default managerService;
