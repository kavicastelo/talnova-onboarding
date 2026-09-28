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
  plan: string;
  packageId?: string;
  packageName?: string;
  packageSlug?: string;
  status: 'Active' | 'Suspended';
  isDeleted?: boolean;
  deletedAt?: string;
  seatLimit?: number;
  subscription?: {
    plan?: string;
    packageName?: string;
    seatLimit?: number;
    packageId?: string;
    billingInterval?: 'monthly' | 'annual';
    basePrice?: number;
    addOnPrice?: number;
    customPrice?: number;
    finalPrice?: number;
    activeAddOns?: string[];
    addOns?: any[];
    addOnsTotal?: number;
  };
  limits?: {
    maxUsers?: number;
    maxStorageGb?: number;
    maxJourneys?: number;
    maxKiosks?: number;
    aiTokenMonthlyLimit?: number;
  };
  usersCount: number;
  createdAt: string;
  supportEmail: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  itemType?: "package_base" | "addon" | "overage" | "custom" | "discount";
  featureKey?: string;
  packageSlug?: string;
}

export interface PackageInvoicePreview {
  organizationId: string;
  customerName: string;
  currency: string;
  billingCycle: 'monthly' | 'annually' | 'quarterly' | 'custom';
  billingInterval: 'monthly' | 'annual';
  package: {
    id: string | null;
    name: string;
    slug: string;
    tier: 'free' | 'standard' | 'custom' | 'enterprise';
    badge?: string;
  };
  limits?: {
    maxUsers?: number;
    maxStorageGb?: number;
    maxJourneys?: number;
    maxKiosks?: number;
    aiTokenMonthlyLimit?: number;
  };
  activeAddOns: string[];
  lineItems: InvoiceLineItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  activeAddOnsCount: number;
  isCustomPrice: boolean;
  negotiatedPrice: number | null;
  issueDate: string;
  dueDate: string;
}

export type InvoiceLifecycleStatus =
  | 'draft'
  | 'issued'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off'
  | 'Paid'
  | 'Pending'
  | 'Overdue';

export interface InvoiceItem {
  id: string;
  _id?: string;
  invoiceNo: string;
  organizationId?: string;
  customerName?: string;
  organization: string;
  packageId?: string;
  packageSlug?: string;
  packageName?: string;
  billingCycle?: 'monthly' | 'annually' | 'quarterly' | 'custom';
  currency?: string;
  issueDate?: string | Date;
  dueDate: string | Date;
  lineItems?: InvoiceLineItem[];
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  amount: number;
  amountPaid?: number;
  balanceDue?: number;
  type: 'Invoice' | 'Receipt';
  status: InvoiceLifecycleStatus;
  notes?: string;
  description: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentRecordItem {
  id: string;
  _id?: string;
  paymentNo: string;
  receiptNo?: string;
  invoiceId?: string;
  invoiceNo?: string;
  organizationId?: string;
  organizationName: string;
  amount: number;
  currency?: string;
  paymentMethod?: string;
  method?: string;
  referenceNumber?: string;
  reference?: string;
  verificationStatus?: 'verified' | 'pending_reconciliation' | 'rejected';
  notes?: string;
  paymentDate?: string;
  recordedAt?: string;
  recordedBy?: string;
}

export interface RecordPaymentPayload {
  invoiceId?: string;
  invoiceNo?: string;
  organizationId?: string;
  organizationName?: string;
  amount: number;
  paymentMethod?: string;
  method?: string;
  referenceNumber?: string;
  reference?: string;
  notes?: string;
}

export interface InvoiceDetailResponse {
  invoice: InvoiceItem;
  payments: PaymentRecordItem[];
}

export type ExpenseCategory =
  | 'infrastructure'
  | 'ai_compute'
  | 'software_licenses'
  | 'salaries'
  | 'marketing'
  | 'office'
  | 'legal'
  | 'other';

export interface ExpenseRecordItem {
  id: string;
  _id?: string;
  expenseNo: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number;
  currency?: string;
  expenseDate: string | Date;
  incurredAt?: string | Date;
  date?: string | Date;
  description: string;
  title?: string;
  notes?: string;
  isRecurring?: boolean;
  receiptUrl?: string;
  recordedBy?: string;
}

export interface RecordExpensePayload {
  category: string;
  vendor: string;
  amount: number;
  currency?: string;
  description?: string;
  title?: string;
  notes?: string;
  expenseDate?: string;
  incurredAt?: string;
  isRecurring?: boolean;
  receiptUrl?: string;
  organizationId?: string;
}

export interface ExpenseListResponse {
  expenses: ExpenseRecordItem[];
  totalExpenses: number;
}

export type CustomerAccountStatus = "good_standing" | "delinquent" | "credit_hold" | "vip";
export type BillingCycle = "monthly" | "quarterly" | "annual";

export interface BillingContact {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface CustomerAccountItem {
  id: string;
  _id?: string;
  organizationId: any;
  organization: {
    id?: string;
    _id?: string;
    name: string;
    slug: string;
    domain?: string;
    plan?: string;
    status?: string;
  };
  accountStatus: CustomerAccountStatus;
  billingCycle: BillingCycle;
  preferredCurrency: string;
  creditLimit: number;
  billingContact: BillingContact;
  commercialNotes?: string;
  totalInvoiced?: number;
  totalPaid?: number;
  totalBalanceDue?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateCustomerAccountPayload {
  accountStatus?: CustomerAccountStatus;
  billingCycle?: BillingCycle;
  creditLimit?: number;
  preferredCurrency?: string;
  billingContact?: BillingContact;
  commercialNotes?: string;
}

export interface CustomerAccountsResponse {
  data: CustomerAccountItem[];
  total: number;
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

export interface PackageDistributionItem {
  name: string;
  slug: string;
  tier: string;
  count: number;
  mrr: number;
  arr: number;
  percentage: number;
  color?: string;
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
  packageDistribution?: PackageDistributionItem[];
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

export interface OrganizationFeatureFlagItem {
  key: string;
  name: string;
  description?: string;
  category?: string;
  environment?: string;
  globalEnabled: boolean;
  override: 'whitelisted' | 'blacklisted' | 'default';
  effectiveEnabled: boolean;
  targetAudience?: string;
  rolloutPercentage?: number;
}

export interface UpdateOrgFlagOverridePayload {
  override: 'whitelisted' | 'blacklisted' | 'default';
  reason?: string;
}

export interface BatchUpdateOrgFlagsPayload {
  updates: Array<{ key: string; override: 'whitelisted' | 'blacklisted' | 'default' }>;
  reason?: string;
}

export interface ApiObservabilityParams {
  organizationId?: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface EndpointMetric {
  route: string;
  method?: string;
  path?: string;
  p95: number;
  avgLatency?: number;
  count24h: number;
  errorRate?: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface ApiObservabilityData {
  latency: {
    p50: number;
    p95: number;
    p99: number;
    unit: string;
  };
  throughput: {
    rpm: number;
    successRate: number;
    errorRate: number;
  };
  endpoints: EndpointMetric[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
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

  getOrganizations: async (params?: { search?: string; page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<OrganizationItem>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<OrganizationItem>>>('/super-admin/organizations', { params });
    return response.data.data;
  },

  createOrganization: async (org: {
    name: string;
    domain?: string;
    slug?: string;
    plan?: 'Starter' | 'Growth' | 'Professional' | 'Enterprise' | string;
    packageId?: string;
    activeAddOns?: string[];
    customPrice?: number;
    billingInterval?: 'monthly' | 'annual';
    adminEmail?: string;
    supportEmail?: string;
    initialPassword?: string;
    sendWelcomeEmail?: boolean;
    requirePasswordChange?: boolean;
  }): Promise<OrganizationItem & {
    credentials?: {
      email: string;
      temporaryPassword: string;
      activationUrl: string;
      mustChangePassword: boolean;
      emailDispatched: boolean;
    };
  }> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/organizations', org);
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

  deleteOrganization: async (id: string, mode: 'soft' | 'hard' = 'hard'): Promise<any> => {
    const response = await apiClient.delete<ApiResponse<any>>(`/super-admin/organizations/${id}`, {
      params: { mode }
    });
    return response.data;
  },

  restoreOrganization: async (id: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/organizations/${id}/restore`);
    return response.data;
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

  getInvoices: async (params?: { search?: string; status?: string; packageSlug?: string; packageId?: string; billingCycle?: string; page?: number; limit?: number }): Promise<{ invoices: PaginatedResponse<InvoiceItem>; summary: FinanceSummary }> => {
    const response = await apiClient.get<ApiResponse<{ invoices: PaginatedResponse<InvoiceItem>; summary: FinanceSummary }>>('/super-admin/invoices', { params });
    return response.data.data;
  },

  getInvoiceById: async (id: string): Promise<InvoiceDetailResponse> => {
    const response = await apiClient.get<ApiResponse<InvoiceDetailResponse>>(`/super-admin/invoices/${id}`);
    return response.data.data;
  },

  getPackageInvoicePreview: async (orgId: string): Promise<PackageInvoicePreview> => {
    const response = await apiClient.get<ApiResponse<PackageInvoicePreview>>(`/super-admin/invoices/preview/${orgId}`);
    return response.data.data;
  },

  createInvoice: async (invoice: any): Promise<InvoiceItem> => {
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

  getApiObservability: async (params?: ApiObservabilityParams | string): Promise<ApiObservabilityData> => {
    let queryParams: any = undefined;
    if (typeof params === 'string') {
      queryParams = params && params !== 'all' ? { organizationId: params } : undefined;
    } else if (params) {
      queryParams = {
        ...params,
        organizationId: params.organizationId && params.organizationId !== 'all' ? params.organizationId : undefined,
      };
    }
    const response = await apiClient.get<ApiResponse<ApiObservabilityData>>('/super-admin/observability/api', { params: queryParams });
    return response.data.data;
  },

  getInfrastructureObservability: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/infrastructure');
    return response.data.data;
  },

  getAIObservability: async (organizationId?: string): Promise<any> => {
    const params = organizationId && organizationId !== 'all' ? { organizationId } : undefined;
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/ai', { params });
    return response.data.data;
  },

  getStorageObservability: async (organizationId?: string): Promise<any> => {
    const params = organizationId && organizationId !== 'all' ? { organizationId } : undefined;
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/observability/storage', { params });
    return response.data.data;
  },

  updateOrganizationStorageLimit: async (id: string, maxStorageGb: number): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/organizations/${id}/storage-limit`, { maxStorageGb });
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

  getExpenses: async (): Promise<ExpenseListResponse> => {
    const response = await apiClient.get<ApiResponse<ExpenseListResponse>>('/super-admin/finance/expenses');
    return response.data.data;
  },

  recordExpense: async (data: RecordExpensePayload): Promise<ExpenseRecordItem> => {
    const response = await apiClient.post<ApiResponse<ExpenseRecordItem>>('/super-admin/finance/expenses', data);
    return response.data.data;
  },

  getCustomerAccounts: async (params?: { search?: string; status?: string }): Promise<CustomerAccountItem[]> => {
    const response = await apiClient.get<ApiResponse<CustomerAccountItem[]>>('/super-admin/finance/accounts', { params });
    return response.data.data;
  },

  updateCustomerAccount: async (id: string, data: UpdateCustomerAccountPayload): Promise<CustomerAccountItem> => {
    const response = await apiClient.patch<ApiResponse<CustomerAccountItem>>(`/super-admin/finance/accounts/${id}`, data);
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

  toggleFeatureFlag: async (key: string, data: { enabled?: boolean; isEnabled?: boolean; rolloutPct?: number; rolloutPercentage?: number;[k: string]: any }): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/settings/flags/${key}`, data);
    return response.data.data;
  },

  createFeatureFlag: async (data: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/settings/flags', data);
    return response.data.data;
  },

  getOrganizationFlags: async (orgId: string): Promise<OrganizationFeatureFlagItem[]> => {
    const response = await apiClient.get<ApiResponse<any>>(`/super-admin/organizations/${orgId}/flags`);
    const data = response.data.data;
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.flags)) return data.flags;
    return [];
  },

  updateOrganizationFlagOverride: async (
    orgId: string,
    flagKey: string,
    payload: UpdateOrgFlagOverridePayload
  ): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(
      `/super-admin/organizations/${orgId}/flags/${flagKey}`,
      payload
    );
    return response.data;
  },

  batchUpdateOrganizationFlags: async (
    orgId: string,
    payload: BatchUpdateOrgFlagsPayload
  ): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(
      `/super-admin/organizations/${orgId}/flags/batch`,
      payload
    );
    return response.data;
  },

  getAlerts: async (params?: {
    organizationId?: string;
    status?: string;
    severity?: string;
    category?: string;
    search?: string;
  }): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/alerts', { params });
    return response.data.data;
  },

  updateAlertStatus: async (
    id: string,
    status: string,
    resolutionNotes?: string
  ): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/alerts/${id}/status`, {
      status,
      resolutionNotes,
    });
    return response.data.data;
  },

  exportCanonicalReport: async (reportId: string, format = 'csv'): Promise<{ blob: Blob; filename: string }> => {
    const response = await apiClient.get(`/super-admin/reports/${reportId}/export`, {
      params: { format },
      responseType: 'blob',
    });
    const disposition = response.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `${reportId}.${format}`;
    return { blob: response.data, filename };
  },

  getPlatformSettings: async (): Promise<PlatformSettingsItem> => {
    const response = await apiClient.get<ApiResponse<PlatformSettingsItem>>('/super-admin/settings/platform');
    return response.data.data;
  },

  updatePlatformSettings: async (data: Partial<PlatformSettingsItem>): Promise<PlatformSettingsItem> => {
    const response = await apiClient.patch<ApiResponse<PlatformSettingsItem>>('/super-admin/settings/platform', data);
    return response.data.data;
  },

  getFeatureAdoption: async (timeWindowDays = 30): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/analytics/feature-adoption', {
      params: { timeWindowDays },
    });
    return response.data.data;
  },

  getDemoOverview: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/demo/overview');
    return response.data.data;
  },
  getDemoCompanies: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/companies');
    return response.data.data;
  },
  getDemoUsers: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/users');
    return response.data.data;
  },
  getDemoSessions: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/sessions');
    return response.data.data;
  },
  getDemoActivity: async (limit = 50): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/activity', { params: { limit } });
    return response.data.data;
  },
  getDemoRiskAlerts: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/risk-alerts');
    return response.data.data;
  },
  getDemoResetHistory: async (): Promise<any[]> => {
    const response = await apiClient.get<ApiResponse<any[]>>('/super-admin/demo/reset/history');
    return response.data.data;
  },
  createDemoCompany: async (payload: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/demo/companies', payload);
    return response.data;
  },
  updateDemoCompany: async (id: string, payload: any): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/demo/companies/${id}`, payload);
    return response.data;
  },
  createDemoUser: async (payload: any): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/demo/users', payload);
    return response.data;
  },
  updateDemoUser: async (id: string, payload: any): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/demo/users/${id}`, payload);
    return response.data;
  },
  terminateDemoSession: async (sessionId: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/demo/sessions/${sessionId}/terminate`);
    return response.data;
  },
  resolveDemoRiskAlert: async (alertId: string, notes?: string): Promise<any> => {
    const response = await apiClient.patch<ApiResponse<any>>(`/super-admin/demo/risk-alerts/${alertId}/resolve`, { notes });
    return response.data;
  },
  resetDemoEnvironment: async (confirmText: string): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>('/super-admin/demo/reset', { confirmText });
    return response.data;
  },
  getDemoTelemetryAnalytics: async (): Promise<any> => {
    const response = await apiClient.get<ApiResponse<any>>('/super-admin/demo/telemetry/analytics');
    return response.data.data;
  },

  // Packages & Plans
  getPackages: async (params?: { status?: string; tier?: string; search?: string }): Promise<{ packages: PackageItem[]; canonicalFeatures: any[]; total: number }> => {
    const response = await apiClient.get<ApiResponse<{ packages: PackageItem[]; canonicalFeatures: any[]; total: number }>>('/super-admin/packages', { params });
    return response.data.data;
  },
  getPackageById: async (id: string): Promise<PackageItem & { sampleTenants?: any[]; canonicalFeatures?: any[] }> => {
    const response = await apiClient.get<ApiResponse<PackageItem & { sampleTenants?: any[]; canonicalFeatures?: any[] }>>(`/super-admin/packages/${id}`);
    return response.data.data;
  },
  createPackage: async (payload: Partial<PackageItem>): Promise<PackageItem> => {
    const response = await apiClient.post<ApiResponse<PackageItem>>('/super-admin/packages', payload);
    return response.data.data;
  },
  updatePackage: async (id: string, payload: Partial<PackageItem>): Promise<PackageItem> => {
    const response = await apiClient.patch<ApiResponse<PackageItem>>(`/super-admin/packages/${id}`, payload);
    return response.data.data;
  },
  deletePackage: async (id: string): Promise<any> => {
    const response = await apiClient.delete<ApiResponse<any>>(`/super-admin/packages/${id}`);
    return response.data.data;
  },
  clonePackage: async (id: string): Promise<PackageItem> => {
    const response = await apiClient.post<ApiResponse<PackageItem>>(`/super-admin/packages/${id}/clone`);
    return response.data.data;
  },
  assignOrganizationPackage: async (orgId: string, payload: AssignPackagePayload): Promise<any> => {
    const response = await apiClient.post<ApiResponse<any>>(`/super-admin/organizations/${orgId}/assign-package`, payload);
    return response.data.data;
  },
};

export interface PackageFeatureItem {
  featureKey: string;
  name: string;
  module: "learning" | "operations" | "compliance" | "people" | "intelligence" | "enterprise";
  description?: string;
  enabled: boolean;
  isAddOn: boolean;
  addOnPriceMonthly?: number;
  addOnPriceAnnual?: number;
}

export interface PackageItem {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  badge?: string;
  tier: "free" | "standard" | "custom" | "enterprise";
  isPublic: boolean;
  isDefault: boolean;
  status: "active" | "archived" | "draft";
  billing: {
    basePriceMonthly: number;
    basePriceAnnual: number;
    currency: string;
  };
  limits: {
    maxUsers: number;
    maxStorageGb: number;
    maxJourneys?: number;
    maxKiosks?: number;
    aiTokenMonthlyLimit?: number;
  };
  features: PackageFeatureItem[];
  activeTenantsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssignPackagePayload {
  packageId: string;
  billingInterval?: "monthly" | "annual";
  activeAddOns?: string[];
  customPrice?: number;
  customLimits?: {
    maxUsers?: number;
    maxStorageGb?: number;
    maxJourneys?: number;
    maxKiosks?: number;
    aiTokenMonthlyLimit?: number;
  };
  featureOverrides?: Array<{
    featureKey: string;
    override: "enable" | "disable" | "default";
    reason?: string;
  }>;
  reason?: string;
}

export interface PlatformSettingsItem {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  sessionTimeoutMinutes: number;
  enforceMfaAdmins: boolean;
  updatedAt?: string;
  updatedBy?: string;
}
