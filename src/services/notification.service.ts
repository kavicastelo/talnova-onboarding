import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface UserNotification {
  id: string;
  type: string;
  channel: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  deepLink?: string;
  createdAt: string;
}

export interface UserNotificationPreferences {
  channels: {
    inApp: boolean;
    email: boolean;
  };
  categories: {
    journeyAssigned: { inApp: boolean; email: boolean };
    journeyOverdue: { inApp: boolean; email: boolean };
    complianceDue: { inApp: boolean; email: boolean };
    announcements: { inApp: boolean; email: boolean };
    reminders: { inApp: boolean; email: boolean };
  };
  quietHours: {
    enabled: boolean;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  };
  frequency: 'immediate' | 'daily_digest' | 'weekly_digest';
}

export const notificationService = {
  getNotifications: async (): Promise<UserNotification[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/notifications');
    return (response.data.data || []).map((n) => ({
      id: n._id,
      type: n.type,
      channel: n.channel,
      title: n.title,
      message: n.message,
      priority: n.priority,
      isRead: n.isRead,
      deepLink: n.data?.deepLink,
      createdAt: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '',
    }));
  },

  getUnreadCount: async (): Promise<number> => {
    const response = await apiClient.get<ApiResponse<{ count: number }>>('/notifications/count');
    return response.data.data?.count || 0;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.patch('/notifications/read-all');
  },

  getPreferences: async (): Promise<UserNotificationPreferences> => {
    const response = await apiClient.get<ApiResponse<UserNotificationPreferences>>('/notifications/preferences');
    return response.data.data;
  },

  updatePreferences: async (
    preferences: Partial<UserNotificationPreferences>
  ): Promise<UserNotificationPreferences> => {
    const response = await apiClient.put<ApiResponse<UserNotificationPreferences>>(
      '/notifications/preferences',
      preferences
    );
    return response.data.data;
  },
};
