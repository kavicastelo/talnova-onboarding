import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface DocumentTemplate {
  _id: string;
  title: string;
  description?: string;
  category: 'nda' | 'code_of_conduct' | 'offer_letter' | 'handbook' | 'direct_deposit' | 'custom';
  content: string;
  signatureRequired: boolean;
  version: number;
  audience?: {
    departmentNames?: string[];
    jobTitleNames?: string[];
    locations?: string[];
    autoAssignNewHires?: boolean;
  };
  createdAt: string;
}

export interface DocumentAssignment {
  _id: string;
  templateId: string;
  templateTitle: string;
  templateVersion: number;
  employeeId: string;
  assignedBy: string;
  status: 'pending' | 'viewed' | 'signed' | 'declined' | 'expired';
  assignedAt: string;
  dueDate?: string;
  signedAt?: string;
  renderedContent?: string;
  signatureData?: {
    type: 'draw' | 'type';
    signatureDataUrl?: string;
    signerName: string;
    signedAt: string;
    sha256Hash: string;
    ipAddress?: string;
  };
  auditTrail: Array<{
    action: string;
    timestamp: string;
    details?: string;
    ipAddress?: string;
  }>;
}

export const documentService = {
  createTemplate: async (data: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
    const response = await apiClient.post<ApiResponse<DocumentTemplate>>('/documents/templates', data);
    return response.data.data;
  },

  listTemplates: async (): Promise<DocumentTemplate[]> => {
    const response = await apiClient.get<ApiResponse<DocumentTemplate[]>>('/documents/templates');
    return response.data.data || [];
  },

  updateTemplate: async (id: string, data: Partial<DocumentTemplate>): Promise<DocumentTemplate> => {
    const response = await apiClient.put<ApiResponse<DocumentTemplate>>(`/documents/templates/${id}`, data);
    return response.data.data;
  },

  deleteTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`/documents/templates/${id}`);
  },

  assignDocument: async (templateId: string, employeeId: string, dueDate?: string): Promise<DocumentAssignment> => {
    const response = await apiClient.post<ApiResponse<DocumentAssignment>>('/documents/assign', {
      templateId,
      employeeId,
      dueDate,
    });
    return response.data.data;
  },

  getEmployeeInbox: async (): Promise<DocumentAssignment[]> => {
    const response = await apiClient.get<ApiResponse<DocumentAssignment[]>>('/documents/inbox');
    return response.data.data || [];
  },

  getDocumentAssignment: async (id: string): Promise<DocumentAssignment> => {
    const response = await apiClient.get<ApiResponse<DocumentAssignment>>(`/documents/${id}`);
    return response.data.data;
  },

  signDocument: async (
    id: string,
    payload: { type: 'draw' | 'type'; signatureDataUrl?: string; signerName: string }
  ): Promise<DocumentAssignment> => {
    const response = await apiClient.post<ApiResponse<DocumentAssignment>>(`/documents/${id}/sign`, payload);
    return response.data.data;
  }
};

export default documentService;
