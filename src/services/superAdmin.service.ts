import { apiClient } from '../api/client';
import { ApiResponse, PaginatedResponse } from '../types';

export interface SuperAdminTelemetry {
  stats: {
    totalOrganizations: { value: number; active?: number; suspended?: number; delta: string };
    platformUsers: { value: number; active?: number; delta: string };
    activeOnboardings?: { value: number; delta?: string };
    cashCollected?: { value: number; delta?: string };
    operatingExpenses?: { value: number; delta?: string };
    netOperatingResult?: { value: number; delta?: string };
    openAlerts?: { value: number; critical?: number; high?: number };
    systemHealth: { value: number; status: string; avgLatencyMs?: number };
    monthlyRevenue: { value: number; delta: string };
  };
  growthData: Array<{
    month: string;
    organizations: number;
    revenue: number;
    users: number;
    onboardings?: number;
  }>;
}

export interface CrossTenantActivityLog {
  id: string;
  org: string;
  event: string;
  time: string;
  type: 'user' | 'journey' | 'finance' | 'settings' | 'system';
}

export interface OrganizationItem {
  id: string;
  name: string;
  domain?: string;
  slug: string;
  plan: 'Starter' | 'Growth' | 'Professional' | 'Enterprise';
  status: 'Active' | 'Suspended';
  seatLimit?: number;
  subscription?: {
    plan?: string;
    seatLimit?: number;
  };
  limits?: {
    maxUsers?: number;
  };
  usersCount: number;
  createdAt: string;
  supportEmail: string;
}

export interface InvoiceItem {
  id: string;
  invoiceNo: string;
  organization: string;
  amount: number;
  type: 'Invoice' | 'Receipt';
  status: 'Paid' | 'Pending' | 'Overdue';
  dueDate: string;
  description: string;
}

export interface FinanceSummary {
  totalRevenue: number;
  pendingRevenue: number;
  overdueRevenue: number;
}

export interface TierDistributionItem {
  tier: string;
  name: string;
  count: number;
  mrr: number;
  arr: number;
  percentage: number;
  color: string;
}

export interface FinanceMonthlyGrowth {
  month: string;
  mrr: number;
  arr: number;
  subscriptions: number;
}

export interface FinanceOverview {
  summary: {
    totalArr: number;
    totalMrr: number;
    activeSubscriptions: number;
    arpu: number;
    platformUsers: number;
    totalRevenue: number;
    pendingRevenue: number;
    overdueRevenue: number;
  };
  tierDistribution: TierDistributionItem[];
  monthlyGrowth: FinanceMonthlyGrowth[];
  invoicesSummary: {
    totalRevenue: number;
    pendingRevenue: number;
    overdueRevenue: number;
    paidCount: number;
    pendingCount: number;
    overdueCount: number;
  };
}

export const superAdminService = {
  getStats: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/stats');
    return response.data.data;
  },

  getTelemetry: async (params?: { organizationId?: string; startDate?: string; endDate?: string }): Promise<SuperAdminTelemetry> => {
    const response = await apiClient.get<ApiResponse<SuperAdminTelemetry>>('/super-admin/telemetry', { params });
    return response.data.data;
  },

  getActivityLogs: async (): Promise<CrossTenantActivityLog[]> => {
    const response = await apiClient.get<ApiResponse<CrossTenantActivityLog[]>>('/super-admin/activity-logs');
    return response.data.data;
  },

  getOrganizations: async (params?: { search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<OrganizationItem>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<OrganizationItem>>>('/super-admin/organizations', { params });
    return response.data.data;
  },

  createOrganization: async (org: {
    name: string;
    domain?: string;
    slug?: string;
    plan: 'Starter' | 'Growth' | 'Professional' | 'Enterprise';
    adminEmail?: string;
    supportEmail?: string;
  }): Promise<OrganizationItem> => {
    const response = await apiClient.post<ApiResponse<OrganizationItem>>('/super-admin/organizations', org);
    return response.data.data;
  },

  updateOrganization: async (id: string, data: { plan?: string; seatQuota?: number; seatLimit?: number; status?: string; name?: string }): Promise<OrganizationItem> => {
    const response = await apiClient.patch<ApiResponse<OrganizationItem>>(`/super-admin/organizations/${id}`, data);
    return response.data.data;
  },

  toggleOrganizationStatus: async (id: string, status: 'Active' | 'Suspended'): Promise<OrganizationItem> => {
    const response = await apiClient.patch<ApiResponse<OrganizationItem>>(`/super-admin/organizations/${id}/status`, { status });
    return response.data.data;
  },

  getOrganization360: async (id: string): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>(`/super-admin/organizations/${id}/360`);
    return response.data.data;
  },

  quarantineOrganization: async (id: string, reason?: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/organizations/${id}/quarantine`, { reason });
    return response.data.data;
  },

  getUsers: async (params?: { search?: string; organizationId?: string; role?: string; status?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/users', { params });
    return response.data.data;
  },

  getUser360: async (id: string): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>(`/super-admin/users/${id}/360`);
    return response.data.data;
  },

  updateUser: async (id: string, data: { role?: string; status?: string; unlock?: boolean }): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/users/${id}`, data);
    return response.data.data;
  },

  forceLogoutUser: async (id: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/users/${id}/force-logout`);
    return response.data.data;
  },

  getSessions: async (params?: { organizationId?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/sessions', { params });
    return response.data.data;
  },

  revokeSession: async (sessionId: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/sessions/${sessionId}/revoke`);
    return response.data.data;
  },

  getInvoices: async (params?: { search?: string; page?: number; limit?: number }): Promise<{ invoices: PaginatedResponse<InvoiceItem>; summary: FinanceSummary }> => {
    const response = await apiClient.get<ApiResponse<{ invoices: PaginatedResponse<InvoiceItem>; summary: FinanceSummary }>>('/super-admin/invoices', { params });
    return response.data.data;
  },

  createInvoice: async (invoice: Omit<InvoiceItem, 'id' | 'invoiceNo' | 'dueDate'>): Promise<InvoiceItem> => {
    const response = await apiClient.post<ApiResponse<InvoiceItem>>('/super-admin/invoices', invoice);
    return response.data.data;
  },

  exportInvoices: async (): Promise<void> => {
    await apiClient.get('/super-admin/invoices/export');
  },

  getFinance: async (): Promise<FinanceOverview> => {
    const response = await apiClient.get<ApiResponse<FinanceOverview>>('/super-admin/finance');
    return response.data.data;
  },

  exportFinance: async (): Promise<void> => {
    await apiClient.get('/super-admin/finance/export');
  },

  globalSearch: async (q: string): Promise<{
    organizations: Array<{ _id: string; name: string; slug: string; domain?: string; plan: string; status: string }>;
    users: Array<{ _id: string; profile: { fullName: string }; auth: { email: string }; permissions: { role: string }; employment?: { status: string; department?: string }; organizationId?: string }>;
    journeys: Array<{ _id: string; title: string; status: string; version: number; organizationId?: string }>;
    invoices: Array<{ _id: string; invoiceNo: string; organization: string; amount: number; status: string; dueDate?: string; organizationId?: string }>;
  }> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/search', { params: { q } });
    return response.data.data;
  },

  getOnboardingCases: async (params?: { organizationId?: string; state?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/onboarding/cases', { params });
    return response.data.data;
  },

  getTasksOps: async (params?: { organizationId?: string; status?: string; type?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/tasks-ops', { params });
    return response.data.data;
  },

  getActivityEvents: async (params?: { organizationId?: string; category?: string; severity?: string; search?: string; page?: number; limit?: number }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/activity', { params });
    return response.data.data;
  },

  getApiObservability: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/api');
    return response.data.data;
  },

  getInfrastructureObservability: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/infrastructure');
    return response.data.data;
  },

  getAIObservability: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/ai');
    return response.data.data;
  },

  getStorageObservability: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/storage');
    return response.data.data;
  },

  getPayments: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/finance/payments');
    return response.data.data;
  },

  recordPayment: async (data: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/finance/payments', data);
    return response.data.data;
  },

  getExpenses: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/finance/expenses');
    return response.data.data;
  },

  recordExpense: async (data: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/finance/expenses', data);
    return response.data.data;
  },

  getFeatureFlags: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/settings/flags');
    return response.data.data;
  },

  updateFeatureFlag: async (key: string, data: any): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/settings/flags/${key}`, data);
    return response.data.data;
  },

  toggleFeatureFlag: async (key: string, data: { enabled?: boolean; isEnabled?: boolean; rolloutPct?: number; rolloutPercentage?: number; [k: string]: any }): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/settings/flags/${key}`, data);
    return response.data.data;
  },

  createFeatureFlag: async (data: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/settings/flags', data);
    return response.data.data;
  },

  getAlerts: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/alerts');
    return response.data.data;
  }
};
