import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface SanitizedSalesIntegration {
  id?: string;
  category: 'ai' | 'email' | 'whatsapp' | string;
  provider: string;
  name: string;
  enabled: boolean;
  status: 'not_configured' | 'configured' | 'valid' | 'invalid';
  publicConfig: Record<string, any>;
  maskedSecrets: Record<string, string>;
  hasSecrets: boolean;
  lastValidatedAt?: string | Date;
  validationError?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  validatedAt: string;
}

export interface SaveSalesIntegrationPayload {
  name?: string;
  enabled?: boolean;
  publicConfig: Record<string, any>;
  secrets?: Record<string, string>;
}

export const salesIntegrationService = {
  listIntegrations: async (): Promise<SanitizedSalesIntegration[]> => {
    const response = await apiClient.get<ApiResponse<SanitizedSalesIntegration[]>>('/sales/integrations');
    return response.data.data;
  },

  getIntegration: async (category: string, provider: string): Promise<SanitizedSalesIntegration> => {
    const response = await apiClient.get<ApiResponse<SanitizedSalesIntegration>>(`/sales/integrations/${category}/${provider}`);
    return response.data.data;
  },

  saveIntegration: async (
    category: string,
    provider: string,
    payload: SaveSalesIntegrationPayload
  ): Promise<SanitizedSalesIntegration> => {
    const response = await apiClient.post<ApiResponse<SanitizedSalesIntegration>>(
      `/sales/integrations/${category}/${provider}`,
      payload
    );
    return response.data.data;
  },

  testIntegration: async (
    category: string,
    provider: string,
    secrets?: Record<string, string>
  ): Promise<ConnectionTestResult> => {
    const response = await apiClient.post<ApiResponse<ConnectionTestResult>>(
      `/sales/integrations/${category}/${provider}/test`,
      { secrets }
    );
    return response.data.data;
  },

  deleteIntegration: async (category: string, provider: string): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.delete<ApiResponse<{ success: boolean; message: string }>>(
      `/sales/integrations/${category}/${provider}`
    );
    return response.data.data;
  },
};

export default salesIntegrationService;
