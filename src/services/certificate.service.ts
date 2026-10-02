import { apiClient } from '../api/client';
import { ApiResponse } from '../types';

export interface SupervisorWitnessDetails {
  supervisorId?: string;
  name: string;
  role?: string;
  method: string;
  witnessedAt: string;
  attestation?: string;
}

export interface PublicCertificate {
  id: string;
  verified?: boolean;
  isAuthentic?: boolean;
  journeyTitle: string;
  recipientName: string;
  employeeId?: string;
  issuedAt?: string;
  issueDate?: string;
  completedAt?: string;
  durationSeconds?: number;
  formattedDuration?: string;
  versionNumber?: number;
  terminalName?: string;
  hardwareGuid?: string;
  location?: string;
  physicalLocation?: string;
  supervisorWitness?: SupervisorWitnessDetails;
  verificationChecksum?: string;
  sha256Signature?: string;
  organizationName?: string;
  credentialId?: string;
  certificateId: string;
  certificateNumber?: string;
  badge?: string;
  qrCodeUrl?: string;
  certificate?: {
    template: 'classic' | 'modern' | 'minimalist' | 'academic' | 'gradient' | 'executive' | string;
    theme?: 'light' | 'dark';
    accentColor?: string;
    badgeStyle?: 'medal' | 'laurel' | 'shield' | 'crypto' | 'ribbon' | string;
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
    try {
      const response = await apiClient.get<ApiResponse<PublicCertificate>>(`/public/certificates/verify/${id}`);
      return response.data.data;
    } catch {
      // Fallback to legacy assignment public verification endpoint
      const response = await apiClient.get<ApiResponse<PublicCertificate>>(`/assignments/public/verify/${id}`);
      return response.data.data;
    }
  }
};
