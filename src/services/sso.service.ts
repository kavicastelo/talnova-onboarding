import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface SSORoleMapping {
  idpGroup: string;
  role: 'admin' | 'manager' | 'employee';
}

export interface SSOConfigData {
  _id?: string;
  organizationId: string;
  provider: 'okta' | 'azure_ad' | 'google_workspace' | 'custom_saml' | 'custom_oidc' | 'saml2';
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
  enabled?: boolean;
  provider?: string;
  ssoUrl?: string;
  entryPoint?: string;
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

  discoverDomain: async (emailOrDomain: string): Promise<SSODiscoveryResult> => {
    const domain = emailOrDomain.includes('@') ? emailOrDomain.split('@')[1] : emailOrDomain;
    const response = await apiClient.post<ApiResponse<SSODiscoveryResult>>('/auth/sso/discover', {
      domain,
      email: emailOrDomain,
    });
    return response.data.data;
  },

  initiateSSO: async (emailOrDomain: string): Promise<{ authUrl: string; redirectUrl?: string; entryPoint?: string; provider: string; state?: string }> => {
    const domain = emailOrDomain.includes('@') ? emailOrDomain.split('@')[1] : emailOrDomain;
    const response = await apiClient.post<ApiResponse<{ authUrl: string; redirectUrl?: string; entryPoint?: string; provider: string; state?: string }>>('/auth/sso/initiate', {
      domain,
      email: emailOrDomain,
    });
    return response.data.data;
  },
};

export default ssoService;
