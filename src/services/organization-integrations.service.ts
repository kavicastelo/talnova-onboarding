import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface CapabilityInfo {
  available: boolean;
  status: 'not_configured' | 'configured' | 'valid' | 'invalid' | 'disabled';
  provider?: string;
  model?: string;
  fromEmail?: string;
  enabled: boolean;
  lastValidatedAt?: string;
  reason?: string;
}

export interface OrganizationCapabilitiesResponse {
  ai: CapabilityInfo;
  email: CapabilityInfo;
}

export interface IntegrationData {
  _id?: string;
  organizationId?: string;
  type: 'ai' | 'email';
  provider: string;
  name?: string;
  status: 'not_configured' | 'configured' | 'valid' | 'invalid' | 'disabled';
  enabled: boolean;
  publicConfig: Record<string, any>;
  hasSecret: boolean;
  maskedSecret?: string;
  lastValidatedAt?: string;
  validationError?: string;
  configured: boolean;
  updatedAt?: string;
}

export interface SaveIntegrationPayload {
  provider: string;
  name?: string;
  enabled?: boolean;
  publicConfig: Record<string, any>;
  secrets?: {
    apiKey?: string;
    password?: string;
    resourceName?: string;
    deploymentName?: string;
  };
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  error?: string;
}

export const organizationIntegrationsService = {
  /**
   * Fetch current organization capabilities (accessible to all authenticated tenant users)
   */
  getCapabilities: async (): Promise<OrganizationCapabilitiesResponse> => {
    const response = await apiClient.get<ApiResponse<OrganizationCapabilitiesResponse>>(
      '/organizations/integrations/capabilities'
    );
    return response.data.data;
  },

  /**
   * Fetch integration configuration (admin only, secrets are masked)
   */
  getIntegration: async (type: 'ai' | 'email'): Promise<IntegrationData> => {
    const response = await apiClient.get<ApiResponse<IntegrationData>>(
      `/organizations/integrations/${type}`
    );
    return response.data.data;
  },

  /**
   * Save or update integration configuration
   */
  saveIntegration: async (
    type: 'ai' | 'email',
    payload: SaveIntegrationPayload
  ): Promise<IntegrationData> => {
    const response = await apiClient.put<ApiResponse<IntegrationData>>(
      `/organizations/integrations/${type}`,
      payload
    );
    return response.data.data;
  },

  /**
   * Test live integration connection
   */
  testIntegration: async (
    type: 'ai' | 'email',
    payload?: {
      provider?: string;
      publicConfig?: Record<string, any>;
      secrets?: Record<string, any>;
      targetEmail?: string;
    }
  ): Promise<TestConnectionResult> => {
    const response = await apiClient.post<ApiResponse<TestConnectionResult>>(
      `/organizations/integrations/${type}/test`,
      payload || {}
    );
    return response.data.data;
  },

  /**
   * Delete integration
   */
  deleteIntegration: async (type: 'ai' | 'email'): Promise<void> => {
    await apiClient.delete(`/organizations/integrations/${type}`);
  },
};

export default organizationIntegrationsService;
