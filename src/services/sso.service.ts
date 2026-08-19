import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface SSORoleMapping {
  idpGroup: string;
  role: 'admin' | 'manager' | 'employee';
}

export interface SSOConfigData {
  _id?: string;
  organizationId: string;
  provider: 'okta' | 'azure_ad' | 'google_workspace' | 'custom_saml' | 'custom_oidc';
  domains: string[];
  issuerUrl?: string;
  clientId?: string;
  clientSecret?: string;
  ssoUrl?: string;
  certificate?: string;
  enforceSSO: boolean;
  defaultRole: 'admin' | 'manager' | 'employee';
  roleMappings: SSORoleMapping[];
  status: 'active' | 'disabled';
}

export interface SSODiscoveryResult {
  ssoEnabled: boolean;
  provider?: string;
  ssoUrl?: string;
  enforceSSO?: boolean;
  organizationId?: string;
}

export const ssoService = {
  getConfig: async (): Promise<SSOConfigData> => {
    const response = await apiClient.get<ApiResponse<SSOConfigData>>('/auth/sso/config');
    return response.data.data;
  },

  saveConfig: async (data: Partial<SSOConfigData>): Promise<SSOConfigData> => {
    const response = await apiClient.put<ApiResponse<SSOConfigData>>('/auth/sso/config', data);
    return response.data.data;
  },

  discoverDomain: async (email: string): Promise<SSODiscoveryResult> => {
    const response = await apiClient.post<ApiResponse<SSODiscoveryResult>>('/auth/sso/discover', { email });
    return response.data.data;
  },

  initiateSSO: async (email: string): Promise<{ authUrl: string; provider: string }> => {
    const response = await apiClient.post<ApiResponse<{ authUrl: string; provider: string }>>('/auth/sso/initiate', { email });
    return response.data.data;
  },
};

export default ssoService;
