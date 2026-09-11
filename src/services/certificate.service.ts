import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface PublicCertificate {
  id: string;
  verified?: boolean;
  journeyTitle: string;
  recipientName: string;
  issuedAt: string;
  issueDate?: string;
  organizationName?: string;
  credentialId?: string;
  certificateId: string;
  certificate?: {
    template: 'classic' | 'modern' | 'minimalist';
    signatureUrl?: string;
    signatoryName?: string;
    signatoryTitle?: string;
  };
  branding: {
    orgName: string;
    primaryColor: string;
    logoUrl: string;
  };
}

export const certificateService = {
  verifyCertificate: async (id: string): Promise<PublicCertificate> => {
    const response = await apiClient.get<ApiResponse<PublicCertificate>>(`/assignments/public/verify/${id}`);
    return response.data.data;
  }
};
