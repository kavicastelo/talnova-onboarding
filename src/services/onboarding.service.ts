import { apiClient } from '../api/client';

export interface IQuarantinedEmployee {
  _id: string;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  status: string;
  managerId?: string;
  hireDate?: string;
}

export interface IExceptionCase {
  _id: string;
  state: 'paused' | 'provisioning_failed' | 'handover_pending' | 'active' | 'cancelled';
  stateReason: string;
  source: string;
  idempotencyKey: string;
  quarantinedAt: string;
  daysQuarantined: number;
  severity: 'critical' | 'high' | 'medium';
  ruleConflicts?: string[];
  slaDeadline?: string | Date;
  failure?: {
    resourceKey?: string;
    message: string;
    attempts: number;
    lastAttemptAt: string;
  };
  resolvedPlan?: {
    planId: string;
    version?: number;
    resolvedAt: string;
    reason?: string;
    confidence?: number;
    matchReason?: string;
  };
  transitions: Array<{
    from: string | null;
    to: string;
    at: string;
    actorUserId?: string;
    reason?: string;
  }>;
  history?: Array<{
    from: string | null;
    to: string;
    at: string;
    actorUserId?: string;
    reason?: string;
  }>;
  employee: IQuarantinedEmployee | null;
  createdAt: string;
  updatedAt: string;
}

export interface IExceptionFilter {
  state?: 'all' | 'paused' | 'provisioning_failed' | 'handover_pending';
  severity?: 'critical' | 'high' | 'medium';
  search?: string;
  page?: number;
  limit?: number;
}

export interface IResolutionRequest {
  action: 'retry' | 'override_journey' | 'force_activate' | 'cancel';
  targetTemplateId?: string;
  reason: string;
  employmentUpdates?: {
    department?: string;
    jobTitle?: string;
    managerId?: string;
  };
}

export interface IExceptionListResponse {
  success: boolean;
  message: string;
  data: IExceptionCase[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const onboardingService = {
  getExceptions: async (filter?: IExceptionFilter): Promise<IExceptionListResponse> => {
    const params = new URLSearchParams();
    if (filter?.state && filter.state !== 'all') params.append('state', filter.state);
    if (filter?.severity) params.append('severity', filter.severity);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.page) params.append('page', filter.page.toString());
    if (filter?.limit) params.append('limit', filter.limit.toString());

    const response = await apiClient.get<IExceptionListResponse>(
      `/onboarding/exceptions?${params.toString()}`
    );
    return response.data;
  },

  resolveException: async (
    caseId: string,
    resolution: IResolutionRequest
  ): Promise<{ success: boolean; message: string; case: any }> => {
    const response = await apiClient.post<{ success: boolean; message: string; case: any }>(
      `/onboarding/exceptions/${caseId}/resolve`,
      resolution
    );
    return response.data;
  },
};

export default onboardingService;
