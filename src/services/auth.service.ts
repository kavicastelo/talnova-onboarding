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
    return {
      id: user._id,
      name: user.profile?.fullName || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Employee',
      email: user.auth?.email || '',
      role: user.permissions?.role === 'super_admin' 
        ? 'super_admin' 
        : (user.permissions?.role === 'owner' || user.permissions?.role === 'admin' ? 'admin' : 'employee'),
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
    return { accessToken, user };
  },

  logout: async (): Promise<void> => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
    }
  },

  forgotPassword: async (email: string): Promise<void> => {
    await apiClient.post('/auth/forgot-password', { email });
  },

  register: async (payload: any): Promise<any> => {
    const res = await apiClient.post<ApiResponse<any>>('/auth/register', payload);
    return res.data.data;
  }
};
