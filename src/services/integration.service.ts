import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface FieldMapping {
  externalField: string;
  internalField: string;
}

export interface HRISIntegrationData {
  _id: string;
  organizationId: string;
  provider: 'bamboohr' | 'workday' | 'rippling' | 'personio' | 'custom_webhook';
  name: string;
  status: 'active' | 'disabled' | 'error';
  apiKey?: string;
  subdomain?: string;
  webhookSecret?: string;
  fieldMappings: FieldMapping[];
  conflictPolicy: 'hris_wins' | 'local_wins';
  autoProvisionJourneys: boolean;
  lastSyncedAt?: string;
  createdAt: string;
}

export interface SyncLogData {
  _id: string;
  status: 'success' | 'partial' | 'failed';
  processedCount: number;
  createdUsersCount: number;
  updatedUsersCount: number;
  errorCount: number;
  durationMs: number;
  createdAt: string;
  errors?: any[];
  dlqEvents?: any[];
}

export const integrationService = {
  getIntegrations: async (): Promise<HRISIntegrationData[]> => {
    const response = await apiClient.get<ApiResponse<HRISIntegrationData[]>>('/integrations');
    return response.data.data || [];
  },

  createIntegration: async (data: Partial<HRISIntegrationData>): Promise<HRISIntegrationData> => {
    const response = await apiClient.post<ApiResponse<HRISIntegrationData>>('/integrations', data);
    return response.data.data;
  },

  updateIntegration: async (id: string, data: Partial<HRISIntegrationData>): Promise<HRISIntegrationData> => {
    const response = await apiClient.put<ApiResponse<HRISIntegrationData>>(`/integrations/${id}`, data);
    return response.data.data;
  },

  deleteIntegration: async (id: string): Promise<void> => {
    await apiClient.delete(`/integrations/${id}`);
  },

  testConnection: async (id: string): Promise<{ connected: boolean; latencyMs: number }> => {
    const response = await apiClient.post<ApiResponse<{ connected: boolean; latencyMs: number }>>(`/integrations/${id}/test`);
    return response.data.data;
  },

  triggerSync: async (id: string): Promise<{ syncLog: SyncLogData }> => {
    const response = await apiClient.post<ApiResponse<{ syncLog: SyncLogData }>>(`/integrations/${id}/sync`);
    return response.data.data;
  },

  getSyncLogs: async (id: string): Promise<SyncLogData[]> => {
    const response = await apiClient.get<ApiResponse<SyncLogData[]>>(`/integrations/${id}/logs`);
    return response.data.data || [];
  },
};

export default integrationService;
