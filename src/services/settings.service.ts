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
      },
      security: {
        allowPasswordLogin: org.securitySettings?.allowPasswordLogin ?? true,
        enforceMfa: org.securitySettings?.enforceMfa ?? false,
        sessionTimeout: org.securitySettings?.sessionTimeout ?? 3600,
      },
      categories: org.categories || ["Engineering", "Sales", "General"],
      certificate: org.certificate || { template: 'classic' }
    };
  },

  updateSettings: async (settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> => {
    let updatedOrg = null;

    // 1. If updating name/supportEmail or notifications, send patch to current organization
    if (settings.orgName !== undefined || settings.supportEmail !== undefined || settings.notifications !== undefined || settings.categories !== undefined || settings.certificate !== undefined) {
      const payload: Record<string, any> = {};
      if (settings.orgName !== undefined) payload.name = settings.orgName;
      if (settings.supportEmail !== undefined) payload.supportEmail = settings.supportEmail;
      if (settings.categories !== undefined) payload.categories = settings.categories;
      if (settings.certificate !== undefined) payload.certificate = settings.certificate;
      if (settings.notifications !== undefined) {
        payload.notificationSettings = {
          assignmentEmail: settings.notifications.newAssignmentEmails,
          reminderEmail: settings.notifications.deadlineReminders,
          weeklyDigest: settings.notifications.weeklyManagerDigest
        };
      }
      
      const response = await apiClient.patch<ApiResponse<any>>('/organizations/current', payload);
      updatedOrg = response.data.data;
    }

    // 2. If updating branding primaryColor or logo, send patch to branding
    if (settings.primaryColor !== undefined || settings.logo !== undefined) {
      const brandingPayload: Record<string, any> = {};
      if (settings.primaryColor !== undefined) brandingPayload.primaryColor = settings.primaryColor;
      if (settings.logo !== undefined) brandingPayload.logo = settings.logo;

      const response = await apiClient.patch<ApiResponse<any>>('/organizations/branding', brandingPayload);
      updatedOrg = response.data.data;
    }

    // 3. If updating security settings, send patch to security
    if (settings.security !== undefined) {
      const response = await apiClient.patch<ApiResponse<any>>('/organizations/security', {
        allowPasswordLogin: settings.security.allowPasswordLogin,
        enforceMfa: settings.security.enforceMfa,
        sessionTimeout: settings.security.sessionTimeout,
      });
      updatedOrg = response.data.data;
    }

    // 4. Fallback to fetch current if nothing was updated or returned
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
      },
      security: {
        allowPasswordLogin: updatedOrg.securitySettings?.allowPasswordLogin ?? true,
        enforceMfa: updatedOrg.securitySettings?.enforceMfa ?? false,
        sessionTimeout: updatedOrg.securitySettings?.sessionTimeout ?? 3600,
      },
      categories: updatedOrg.categories || ["Engineering", "Sales", "General"],
      certificate: updatedOrg.certificate || { template: 'classic' }
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
  },

  getDepartments: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/organizations/departments');
    return response.data.data || [];
  },

  createDepartment: async (deptData: { name: string; description?: string }): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/organizations/departments', deptData);
    return response.data.data;
  },

  deleteDepartment: async (id: string): Promise<any> => {
    const response = await apiClient.delete<ApiResponse<any>>(`/organizations/departments/${id}`);
    return response.data.data;
  }
};

