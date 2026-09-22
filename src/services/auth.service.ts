import { apiClient } from '../api/client';
import { User, ApiResponse } from '../types';

export const authService = {
  getCurrentUser: async (): Promise<User> => {
    // 1. Fetch current employee profile
    const profileRes = await apiClient.get<ApiResponse<any>>('/employees/me');
    const user = profileRes.data.data;

    // 2. Fetch organization branding/settings to get the company name
    const orgRes = await apiClient.get<ApiResponse<any>>('/organizations/current').catch(() => ({
      data: { data: { name: 'Talnova' } }
    }));
    const orgName = orgRes.data.data?.name || 'Talnova';

    // 3. Map to frontend user format
    const userRole = (user.permissions?.role || 'employee') as any;
    const userRoles = Array.isArray(user.permissions?.roles) && user.permissions.roles.length > 0
      ? user.permissions.roles
      : [userRole];

    return {
      id: user._id,
      name: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Employee',
      email: user.auth?.email || '',
      role: userRole,
      roles: userRoles,
      avatar: user.profile?.avatar?.publicUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.profile?.firstName || 'User')}`,
      company: orgName,
    };
  },

  login: async (email: string, password: string): Promise<any> => {
    const res = await apiClient.post<ApiResponse<{ accessToken: string; user: any }>>('/auth/login', {
      email,
      password
    });
    const { accessToken, user } = res.data.data;
    localStorage.setItem('auth_token', accessToken);
    const userRole = user?.role || 'employee';
    const userRoles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [userRole];
    localStorage.setItem('user_role', userRole);
    localStorage.setItem('user_roles', JSON.stringify(userRoles));
    return { accessToken, user };
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_roles');
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },

  resetPassword: async (payload: { token: string; password: string }): Promise<void> => {
    await apiClient.post('/auth/reset-password', payload);
  },

  register: async (payload: any): Promise<any> => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/register', payload);
    return res.data.data;
  },

  verifyInvitation: async (token: string): Promise<{
    email: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    role?: string;
    organizationName: string;
    organizationSlug?: string;
    organizationLogo?: string;
  }> => {
    const res = await apiClient.get<ApiResponse<any>>('/auth/invitations/verify', {
      params: { token },
    });
    return res.data.data;
  },

  acceptInvitation: async (payload: { token: string; password: string }): Promise<any> => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/invitations/accept', payload);
    const { accessToken, user } = res.data.data || {};
    if (accessToken) {
      localStorage.setItem('auth_token', accessToken);
    }
    const userRole = user?.role || 'employee';
    const userRoles = Array.isArray(user?.roles) && user.roles.length > 0 ? user.roles : [userRole];
    localStorage.setItem('user_role', userRole);
    localStorage.setItem('user_roles', JSON.stringify(userRoles));
    return { accessToken, user };
  }
};
