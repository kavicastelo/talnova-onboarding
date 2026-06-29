import { apiClient } from '../api/client';
import { ApiResponse, PaginatedResponse } from '../types';

export interface SuperAdminTelemetry {
  stats: {
    totalOrganizations: { value: number; delta: string };
    platformUsers: { value: number; delta: string };
    monthlyRevenue: { value: number; delta: string };
    systemHealth: { value: number; status: string };
  };
  growthData: Array<{
    month: string;
    organizations: number;
    revenue: number;
    users: number;
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
  slug: string;
  plan: 'Starter' | 'Growth' | 'Enterprise';
  status: 'Active' | 'Suspended';
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

export const superAdminService = {
  getTelemetry: async (): Promise<SuperAdminTelemetry> => {
    const response = await apiClient.get<ApiResponse<SuperAdminTelemetry>>('/super-admin/telemetry');
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

  createOrganization: async (org: Omit<OrganizationItem, 'id' | 'status' | 'usersCount' | 'createdAt'>): Promise<OrganizationItem> => {
    const response = await apiClient.post<ApiResponse<OrganizationItem>>('/super-admin/organizations', org);
    return response.data.data;
  },

  toggleOrganizationStatus: async (id: string, status: 'Active' | 'Suspended'): Promise<OrganizationItem> => {
    const response = await apiClient.patch<ApiResponse<OrganizationItem>>(`/super-admin/organizations/${id}/status`, { status });
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
  }
};
