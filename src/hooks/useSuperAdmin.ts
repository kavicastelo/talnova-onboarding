import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  superAdminService,
  type UpdateOrgFlagOverridePayload,
  type BatchUpdateOrgFlagsPayload,
  type ApiObservabilityParams,
} from '../services/superAdmin.service';
import { apiClient } from '../api/client';

export function useSuperAdminStats() {
  return useQuery({
    queryKey: ['superAdminStats'],
    queryFn: superAdminService.getStats,
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminTelemetry(params?: { organizationId?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['superAdminTelemetry', params],
    queryFn: () => superAdminService.getTelemetry(params),
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useSuperAdminActivityLogs() {
  return useQuery({
    queryKey: ['superAdminActivityLogs'],
    queryFn: superAdminService.getActivityLogs,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useSuperAdminOrganizations(params?: { search?: string; page?: number; limit?: number; status?: string }) {
  return useQuery({
    queryKey: ['superAdminOrganizations', params],
    queryFn: () => superAdminService.getOrganizations(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      superAdminService.updateOrganization(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
  });
}

export function useToggleOrganizationStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'Active' | 'Suspended' }) =>
      superAdminService.toggleOrganizationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: 'soft' | 'hard' }) =>
      superAdminService.deleteOrganization(id, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
  });
}

export function useRestoreOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminService.restoreOrganization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
  });
}

export function useSuperAdminInvoices(params?: {
  search?: string;
  status?: string;
  packageSlug?: string;
  packageId?: string;
  billingCycle?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['superAdminInvoices', params],
    queryFn: () => superAdminService.getInvoices(params),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePackageInvoicePreview(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['superAdminPackageInvoicePreview', orgId],
    queryFn: () => (orgId ? superAdminService.getPackageInvoicePreview(orgId) : null),
    enabled: Boolean(orgId && orgId !== 'undefined' && orgId !== ''),
    staleTime: 60 * 1000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: superAdminService.createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminFinance'] });
    },
  });
}

export function useInvoiceDetail(id: string | null) {
  return useQuery({
    queryKey: ['superAdminInvoiceDetail', id],
    queryFn: () => (id ? superAdminService.getInvoiceById(id) : null),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminFinance() {
  return useQuery({
    queryKey: ['superAdminFinance'],
    queryFn: superAdminService.getFinance,
    staleTime: 60 * 1000,
  });
}

export function useSuperAdminOrganization360(id?: string) {
  return useQuery({
    queryKey: ['superAdminOrganization360', id],
    queryFn: () => (id ? superAdminService.getOrganization360(id) : null),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useQuarantineOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      superAdminService.quarantineOrganization(id, reason),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganization360', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
    },
  });
}

export function useSuperAdminUsers(params?: { search?: string; organizationId?: string; role?: string; status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminUsers', params],
    queryFn: () => superAdminService.getUsers(params),
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminUser360(id?: string) {
  return useQuery({
    queryKey: ['superAdminUser360', id],
    queryFn: () => (id ? superAdminService.getUser360(id) : null),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useUpdateSuperAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { role?: string; status?: string; unlock?: boolean } }) =>
      superAdminService.updateUser(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminUser360', variables.id] });
    },
  });
}

export function useForceLogoutUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminService.forceLogoutUser(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminUser360', id] });
      queryClient.invalidateQueries({ queryKey: ['superAdminSessions'] });
    },
  });
}

export function useSuperAdminSessions(params?: { organizationId?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminSessions', params],
    queryFn: () => superAdminService.getSessions(params),
    staleTime: 15 * 1000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => superAdminService.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminSessions'] });
    },
  });
}

export function useSuperAdminOnboardingCases(params?: { organizationId?: string; state?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminOnboardingCases', params],
    queryFn: () => superAdminService.getOnboardingCases(params),
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminTasksOps(params?: { organizationId?: string; status?: string; type?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminTasksOps', params],
    queryFn: () => superAdminService.getTasksOps(params),
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminActivityEvents(params?: { organizationId?: string; category?: string; severity?: string; search?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['superAdminActivityEvents', params],
    queryFn: () => superAdminService.getActivityEvents(params),
    staleTime: 20 * 1000,
  });
}

export function useSuperAdminApiObservability(params?: ApiObservabilityParams | string) {
  return useQuery({
    queryKey: ['superAdminApiObservability', params],
    queryFn: () => superAdminService.getApiObservability(params),
    staleTime: 15 * 1000,
  });
}

export function useSuperAdminInfrastructure() {
  return useQuery({
    queryKey: ['superAdminInfrastructure'],
    queryFn: superAdminService.getInfrastructureObservability,
    staleTime: 15 * 1000,
  });
}

export function useSuperAdminAIObservability(organizationId?: string) {
  return useQuery({
    queryKey: ['superAdminAIObservability', organizationId],
    queryFn: () => superAdminService.getAIObservability(organizationId),
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminStorage(organizationId?: string) {
  return useQuery({
    queryKey: ['superAdminStorage', organizationId],
    queryFn: () => superAdminService.getStorageObservability(organizationId),
    staleTime: 30 * 1000,
  });
}

export function useUpdateOrganizationStorageLimit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, maxStorageGb }: { id: string; maxStorageGb: number }) =>
      superAdminService.updateOrganizationStorageLimit(id, maxStorageGb),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminStorage'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}

export function useSuperAdminPayments() {
  return useQuery({
    queryKey: ['superAdminPayments'],
    queryFn: superAdminService.getPayments,
    staleTime: 30 * 1000,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => superAdminService.recordPayment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPayments'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminFinance'] });
    },
  });
}

export function useSuperAdminExpenses() {
  return useQuery({
    queryKey: ['superAdminExpenses'],
    queryFn: superAdminService.getExpenses,
    staleTime: 30 * 1000,
  });
}

export function useRecordExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => superAdminService.recordExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminExpenses'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminTelemetry'] });
    },
  });
}

export function useSuperAdminFeatureFlags() {
  return useQuery({
    queryKey: ['superAdminFeatureFlags'],
    queryFn: superAdminService.getFeatureFlags,
    staleTime: 60 * 1000,
  });
}

export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: any }) =>
      superAdminService.toggleFeatureFlag(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminFeatureFlags'] });
    },
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, data }: { key: string; data: any }) =>
      superAdminService.updateFeatureFlag(key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminFeatureFlags'] });
    },
  });
}

export function useCreateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => superAdminService.createFeatureFlag(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminFeatureFlags'] });
    },
  });
}

export function useSuperAdminOrganizationFlags(orgId: string | undefined) {
  return useQuery({
    queryKey: ['superAdminOrganizationFlags', orgId],
    queryFn: () => (orgId ? superAdminService.getOrganizationFlags(orgId) : Promise.resolve([])),
    enabled: Boolean(orgId),
    staleTime: 30 * 1000,
  });
}

export function useUpdateOrganizationFlagOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      flagKey,
      payload,
    }: {
      orgId: string;
      flagKey: string;
      payload: UpdateOrgFlagOverridePayload;
    }) => superAdminService.updateOrganizationFlagOverride(orgId, flagKey, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizationFlags', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['superAdminFeatureFlags'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganization360', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}

export function useBatchUpdateOrganizationFlags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      payload,
    }: {
      orgId: string;
      payload: BatchUpdateOrgFlagsPayload;
    }) => superAdminService.batchUpdateOrganizationFlags(orgId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizationFlags', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['superAdminFeatureFlags'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganization360', variables.orgId] });
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
    },
  });
}

export function useSuperAdminAlerts(params?: {
  organizationId?: string;
  status?: string;
  severity?: string;
  category?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['superAdminAlerts', params],
    queryFn: () => superAdminService.getAlerts(params),
    staleTime: 15 * 1000,
  });
}

export function useUpdateAlertStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      resolutionNotes,
    }: {
      id: string;
      status: string;
      resolutionNotes?: string;
    }) => superAdminService.updateAlertStatus(id, status, resolutionNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminAlerts'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminStats'] });
    },
  });
}

export function useSuperAdminCustomerAccounts(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: ['superAdminCustomerAccounts', params],
    queryFn: () => superAdminService.getCustomerAccounts(params),
    staleTime: 30 * 1000,
  });
}

export function useUpdateCustomerAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      superAdminService.updateCustomerAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminCustomerAccounts'] });
    },
  });
}

export function useSuperAdminPlatformSettings() {
  return useQuery({
    queryKey: ['superAdminPlatformSettings'],
    queryFn: () => superAdminService.getPlatformSettings(),
    staleTime: 30 * 1000,
  });
}

export function useUpdatePlatformSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => superAdminService.updatePlatformSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPlatformSettings'] });
    },
  });
}

export function useSuperAdminFeatureAdoption(timeWindowDays = 30) {
  return useQuery({
    queryKey: ['super-admin', 'feature-adoption', timeWindowDays],
    queryFn: async () => {
      const res = await apiClient.get('/super-admin/analytics/feature-adoption', {
        params: { timeWindowDays },
      });
      return res.data?.data || res.data || [];
    },
    refetchInterval: 60000,
  });
}

export const useFeatureAdoptionSummary = useSuperAdminFeatureAdoption;

// =============================================================================
// Package & Plan Management Hooks
// =============================================================================

export function useSuperAdminPackages(params?: { status?: string; tier?: string; search?: string }) {
  return useQuery({
    queryKey: ['superAdminPackages', params],
    queryFn: () => superAdminService.getPackages(params),
    staleTime: 30 * 1000,
  });
}

export function useSuperAdminPackage(id?: string) {
  return useQuery({
    queryKey: ['superAdminPackage', id],
    queryFn: () => (id ? superAdminService.getPackageById(id) : null),
    enabled: Boolean(id),
    staleTime: 30 * 1000,
  });
}

export function useCreatePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => superAdminService.createPackage(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPackages'] });
    },
  });
}

export function useUpdatePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      superAdminService.updatePackage(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPackages'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminPackage', variables.id] });
    },
  });
}

export function useDeletePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminService.deletePackage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPackages'] });
    },
  });
}

export function useClonePackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => superAdminService.clonePackage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superAdminPackages'] });
    },
  });
}

export function useAssignOrganizationPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { orgId?: string; id?: string; payload?: any; data?: any }) => {
      const targetOrgId = variables.orgId || variables.id;
      const targetPayload = variables.payload || variables.data;
      if (!targetOrgId || targetOrgId === 'undefined') {
        throw new Error('Valid organization ID is required');
      }
      return superAdminService.assignOrganizationPackage(targetOrgId, targetPayload);
    },
    onSuccess: (_, variables) => {
      const targetOrgId = variables.orgId || variables.id;
      if (targetOrgId) {
        queryClient.invalidateQueries({ queryKey: ['superAdminOrganization360', targetOrgId] });
      }
      queryClient.invalidateQueries({ queryKey: ['superAdminOrganizations'] });
      queryClient.invalidateQueries({ queryKey: ['superAdminPackages'] });
      queryClient.invalidateQueries({ queryKey: ['organizationUsage'] });
    },
  });
}



