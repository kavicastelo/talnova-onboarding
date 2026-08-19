import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface BuddyProfile {
  _id: string;
  userId: any;
  isAvailable: boolean;
  maxMentees: number;
  currentMenteeCount: number;
  skills: string[];
  department?: string;
  jobTitle?: string;
  bio?: string;
}

export interface BuddyAssignment {
  _id: string;
  buddyUserId: any;
  newHireUserId: any;
  assignedAt: string;
  status: 'active' | 'completed' | 'reassigned';
  checklist: Array<{
    _id?: string;
    title: string;
    description?: string;
    stage: 'preboarding' | 'day_1' | 'week_1' | 'month_1';
    completed: boolean;
    completedAt?: string;
  }>;
  checkins: Array<{
    completedAt: string;
    notes: string;
    rating?: number;
  }>;
  communicationLinks: {
    slackChannelUrl?: string;
    teamsUrl?: string;
    email?: string;
  };
}

export const buddyService = {
  registerProfile: async (data: Partial<BuddyProfile>): Promise<BuddyProfile> => {
    const response = await apiClient.post<ApiResponse<BuddyProfile>>('/buddy/profiles', data);
    return response.data.data;
  },

  listAvailableBuddies: async (): Promise<BuddyProfile[]> => {
    const response = await apiClient.get<ApiResponse<BuddyProfile[]>>('/buddy/available');
    return response.data.data || [];
  },

  assignBuddy: async (newHireUserId: string, buddyUserId: string): Promise<BuddyAssignment> => {
    const response = await apiClient.post<ApiResponse<BuddyAssignment>>('/buddy/assign', {
      newHireUserId,
      buddyUserId,
    });
    return response.data.data;
  },

  getEmployeeBuddy: async (): Promise<BuddyAssignment | null> => {
    const response = await apiClient.get<ApiResponse<BuddyAssignment>>('/buddy/my-buddy');
    return response.data.data;
  },

  getBuddyMentees: async (): Promise<BuddyAssignment[]> => {
    const response = await apiClient.get<ApiResponse<BuddyAssignment[]>>('/buddy/my-mentees');
    return response.data.data || [];
  },

  updateChecklistTask: async (assignmentId: string, taskId: string, completed: boolean): Promise<BuddyAssignment> => {
    const response = await apiClient.put<ApiResponse<BuddyAssignment>>(`/buddy/assignment/${assignmentId}/checklist`, {
      taskId,
      completed,
    });
    return response.data.data;
  },

  logBuddyCheckin: async (assignmentId: string, payload: { notes: string; rating?: number }): Promise<BuddyAssignment> => {
    const response = await apiClient.post<ApiResponse<BuddyAssignment>>(`/buddy/assignment/${assignmentId}/checkin`, payload);
    return response.data.data;
  },
};

export default buddyService;
