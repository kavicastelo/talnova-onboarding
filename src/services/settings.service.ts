import { apiClient } from '../api/client';
import { WorkspaceSettings, ApiResponse, AppNotification } from '../types';

export const settingsService = {
  getSettings: async (): Promise<WorkspaceSettings> => {
    const response = await apiClient.get<ApiResponse<any>>('/organizations/current');
    const org = response.data.data;
    
    return {
      orgName: org.name || '',
      workspaceUrl: org.slug || '',
      supportEmail: org.supportEmail || '',
      logoUrl: org.branding?.logo?.publicUrl || '',
      primaryColor: org.branding?.primaryColor || '#000000',
      notifications: {
        newAssignmentEmails: org.notificationSettings?.assignmentEmail ?? true,
        deadlineReminders: org.notificationSettings?.reminderEmail ?? true,
        weeklyManagerDigest: org.notificationSettings?.weeklyDigest ?? true,
      }
    };
  },

  updateSettings: async (settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> => {
    let updatedOrg = null;

    // 1. If updating name/supportEmail, send patch to current organization
    if (settings.orgName !== undefined || settings.supportEmail !== undefined) {
      const payload: Record<string, any> = {};
      if (settings.orgName !== undefined) payload.name = settings.orgName;
      if (settings.supportEmail !== undefined) payload.supportEmail = settings.supportEmail;
      
      const response = await apiClient.patch<ApiResponse<any>>('/organizations/current', payload);
      updatedOrg = response.data.data;
    }

    // 2. If updating branding primaryColor, send patch to branding
    if (settings.primaryColor !== undefined) {
      const response = await apiClient.patch<ApiResponse<any>>('/organizations/branding', {
        primaryColor: settings.primaryColor
      });
      updatedOrg = response.data.data;
    }

    // 3. Fallback to fetch current if nothing was updated or returned
    if (!updatedOrg) {
      const response = await apiClient.get<ApiResponse<any>>('/organizations/current');
      updatedOrg = response.data.data;
    }

    return {
      orgName: updatedOrg.name || '',
      workspaceUrl: updatedOrg.slug || '',
      supportEmail: updatedOrg.supportEmail || '',
      logoUrl: updatedOrg.branding?.logo?.publicUrl || '',
      primaryColor: updatedOrg.branding?.primaryColor || '#000000',
      notifications: {
        newAssignmentEmails: updatedOrg.notificationSettings?.assignmentEmail ?? true,
        deadlineReminders: updatedOrg.notificationSettings?.reminderEmail ?? true,
        weeklyManagerDigest: updatedOrg.notificationSettings?.weeklyDigest ?? true,
      }
    };
  },

  getNotifications: async (): Promise<AppNotification[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/notifications');
    return (response.data.data || []).map(n => ({
      id: n._id,
      title: n.title || 'Notification',
      subtitle: n.message || '',
      createdAt: n.createdAt ? new Date(n.createdAt).toLocaleDateString() : '',
    }));
  }
};

