import { apiClient } from '../../../api/client';
import { KioskJourney, KioskJourneyVersion, ValidationReport } from '../../../types/kiosk/journey.types';
import { KioskDevice, KioskTelemetry, KioskDeviceManifest, PendingCommand } from '../../../types/kiosk/device.types';
import { KioskDeviceGroup } from '../../../types/kiosk/group.types';
import { KioskAnalytics, KioskAnalyticsSummary } from '../../../types/kiosk/analytics.types';
import { KioskSession } from '../../../types/kiosk/session.types';
import { KioskEmergency, EmergencyBroadcastPayload, EmergencyClearPayload } from '../../../types/kiosk/emergency.types';
import {
  KioskComplianceSummary,
  DepartmentComplianceResponse,
  ComplianceFilterParams
} from '../../../types/kiosk/compliance.types';
import { deviceIdentityService } from './device-identity.service';

export const kioskService = {
  // --- Journey Builder API ---
  createJourney: async (payload: Partial<KioskJourney>): Promise<KioskJourney> => {
    const { _id, organizationId, createdAt, updatedAt, createdBy, updatedBy, isDeleted, deletedAt, __v, ...cleanPayload } = payload as any;
    if (cleanPayload.settings?.security?.requireSupervisorWitness !== undefined) {
      if (cleanPayload.settings.requireSupervisorWitness === undefined) {
        cleanPayload.settings.requireSupervisorWitness = cleanPayload.settings.security.requireSupervisorWitness;
      }
      const { requireSupervisorWitness, ...cleanSecurity } = cleanPayload.settings.security;
      cleanPayload.settings = { ...cleanPayload.settings, security: cleanSecurity };
    }
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>('/kiosk/journeys', cleanPayload);
    return response.data.data;
  },

  getJourney: async (id: string): Promise<KioskJourney> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}`);
    return response.data.data;
  },

  validateJourney: async (id: string): Promise<ValidationReport> => {
    const response = await apiClient.post<{ success: boolean; data: ValidationReport }>(`/kiosk/journeys/${id}/validate`);
    return response.data.data;
  },

  updateJourney: async (id: string, payload: Partial<KioskJourney>): Promise<KioskJourney> => {
    const { _id, organizationId, createdAt, updatedAt, createdBy, updatedBy, isDeleted, deletedAt, __v, ...cleanPayload } = payload as any;
    if (cleanPayload.settings?.security?.requireSupervisorWitness !== undefined) {
      if (cleanPayload.settings.requireSupervisorWitness === undefined) {
        cleanPayload.settings.requireSupervisorWitness = cleanPayload.settings.security.requireSupervisorWitness;
      }
      const { requireSupervisorWitness, ...cleanSecurity } = cleanPayload.settings.security;
      cleanPayload.settings = { ...cleanPayload.settings, security: cleanSecurity };
    }
    const response = await apiClient.put<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}`, cleanPayload);
    return response.data.data;
  },

  deleteJourney: async (id: string): Promise<void> => {
    await apiClient.delete(`/kiosk/journeys/${id}`);
  },

  publishJourney: async (
    id: string,
    changelog?: string,
    scheduling?: { publishAt?: string | Date; expiresAt?: string | Date }
  ): Promise<KioskJourney> => {
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}/publish`, {
      changelog,
      scheduling
    });
    return response.data.data;
  },

  unpublishJourney: async (id: string): Promise<KioskJourney> => {
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}/unpublish`);
    return response.data.data;
  },

  rollbackJourney: async (id: string, version: number): Promise<KioskJourney> => {
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}/rollback/${version}`);
    return response.data.data;
  },

  listJourneyVersions: async (id: string): Promise<KioskJourneyVersion[]> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourneyVersion[] }>(`/kiosk/journeys/${id}/versions`);
    return response.data.data;
  },

  getJourneyVersion: async (id: string, version: number): Promise<KioskJourneyVersion> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourneyVersion }>(`/kiosk/journeys/${id}/versions/${version}`);
    return response.data.data;
  },

  getDeviceManifest: async (deviceId?: string): Promise<KioskDeviceManifest> => {
    const path = deviceId ? `/kiosk/devices/${deviceId}/manifest` : '/kiosk/devices/manifest';
    const response = await apiClient.get<{ success: boolean; data: KioskDeviceManifest }>(path);
    return response.data.data;
  },

  listJourneys: async (params?: { page?: number; limit?: number; search?: string }): Promise<{ journeys: KioskJourney[]; total: number }> => {
    interface ListResponse {
      success: boolean;
      data: KioskJourney[];
      meta?: { total: number };
    }
    const response = await apiClient.get<ListResponse>('/kiosk/journeys', { params });
    return {
      journeys: response.data.data || [],
      total: response.data.meta?.total || (response.data.data || []).length
    };
  },

  // --- Device Management ---
  pairDevice: async (payload: { code: string; deviceId: string; name: string; location: string }): Promise<{ device: KioskDevice; token: string; deviceToken: string }> => {
    const response = await apiClient.post<any>('/kiosk/devices/pair', payload);
    const data = response.data?.data || response.data;
    const token = data?.deviceToken || data?.token || response.data?.deviceToken;
    const device = data?.device || response.data?.device;
    return { device, token, deviceToken: token };
  },

  generatePairingCode: async (deviceId?: string): Promise<{ code: string; expiresInSeconds: number }> => {
    const payload = deviceId ? { deviceId } : {};
    const response = await apiClient.post<any>('/kiosk/devices/pair/code', payload);
    const code = response.data?.code || response.data?.data?.code || '';
    const expiresInSeconds = response.data?.expiresInSeconds || response.data?.data?.expiresInSeconds || 900;
    return { code, expiresInSeconds };
  },

  updateDevice: async (
    deviceId: string,
    data: {
      name?: string;
      location?: string;
      siteId?: string | null;
      deviceType?: string;
      deviceGroupId?: string | null;
    }
  ): Promise<KioskDevice> => {
    const response = await apiClient.patch<{ success: boolean; data: KioskDevice }>(
      `/kiosk/devices/${deviceId}`,
      data
    );
    return response.data.data;
  },

  refreshDeviceToken: async (): Promise<{ device: KioskDevice; token: string; deviceToken: string }> => {
    const response = await apiClient.post<any>('/kiosk/devices/refresh-token');
    const data = response.data?.data || response.data;
    const token = data?.deviceToken || data?.token || response.data?.deviceToken;
    const device = data?.device || response.data?.device;
    return { device, token, deviceToken: token };
  },

  heartbeat: async (payload: {
    currentContentVersion?: number;
    telemetry?: KioskTelemetry;
    batteryLevel?: number;
    isCharging?: boolean;
    storageUsedBytes?: number;
    storageFreeBytes?: number;
    storageTotalBytes?: number;
    networkLatencyMs?: number;
    screenResolution?: string;
    orientation?: string;
    appVersion?: string;
  }): Promise<{ success: boolean; serverTime: number; commands: PendingCommand[]; data?: any }> => {
    const response = await apiClient.post<any>('/kiosk/devices/heartbeat', payload);
    const data = response.data;
    return {
      success: data?.success ?? true,
      serverTime: data?.serverTime || Date.now(),
      commands: data?.commands || data?.data?.commands || [],
      data: data?.data || data
    };
  },

  listDevices: async (params?: { page?: number; limit?: number; status?: string }): Promise<{ devices: KioskDevice[]; total: number }> => {
    interface ListResponse {
      success: boolean;
      data: KioskDevice[];
      meta?: { total: number };
    }
    const response = await apiClient.get<ListResponse>('/kiosk/devices', { params });
    return {
      devices: response.data.data,
      total: response.data.meta?.total || response.data.data.length
    };
  },

  updateDeviceStatus: async (id: string, status: string): Promise<KioskDevice> => {
    const response = await apiClient.put<{ success: boolean; data: KioskDevice }>(`/kiosk/devices/${id}/status`, { status });
    return response.data.data;
  },

  pairJourneyToDevice: async (deviceId: string, journeyId: string | null): Promise<KioskDevice> => {
    const response = await apiClient.post<{ success: boolean; data: KioskDevice }>(`/kiosk/devices/${deviceId}/pair-journey`, { journeyId });
    return response.data.data;
  },

  getDeviceAssignments: async (deviceId: string): Promise<any[]> => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/kiosk/devices/${deviceId}/assignments`);
    return response.data.data;
  },

  setDeviceAssignments: async (
    deviceId: string,
    assignments: Array<{
      journeyId: string;
      priority?: number;
      isMandatory?: boolean;
      scheduling?: any;
    }>
  ): Promise<any[]> => {
    const response = await apiClient.post<{ success: boolean; data: any[] }>(`/kiosk/devices/${deviceId}/assignments`, { assignments });
    return response.data.data;
  },

  revokeDevice: async (deviceId: string): Promise<KioskDevice> => {
    const response = await apiClient.post<{ success: boolean; data: KioskDevice }>(`/kiosk/devices/${deviceId}/revoke`);
    return response.data.data;
  },

  // --- Player & Playback ---
  verifyPin: async (journeyId: string, pinCode: string): Promise<boolean> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`/kiosk/journeys/${journeyId}/auth/pin`, { pinCode });
    return response.data.success;
  },

  verifySupervisorPin: async (
    supervisorIdentifier: string,
    pin: string,
    sessionId?: string,
    organizationId?: string
  ): Promise<{
    verified: boolean;
    supervisor: any;
    witnessToken?: string;
    session?: any;
    message?: string;
  }> => {
    const payload: any = {
      supervisorIdentifier,
      pin
    };
    if (sessionId) payload.sessionId = sessionId;
    if (organizationId) payload.organizationId = organizationId;
    const response = await apiClient.post<any>('/kiosk/supervisor/verify-pin', payload);
    return response.data;
  },

  syncAnalytics: async (sessions: Partial<KioskAnalytics>[], signedParams?: { o: string; exp: string; sig: string; journeyId?: string }): Promise<any> => {
    const response = await apiClient.post<{ success: boolean; data: any }>('/kiosk/analytics/sync', { sessions }, { params: signedParams });
    return response.data.data;
  },

  getPublicPlaybackJourney: async (journeyId: string, queryParams: { o: string; exp: string; sig: string }): Promise<KioskJourney> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/play/${journeyId}`, { params: queryParams });
    return response.data.data;
  },

  getJourneyAnalytics: async (journeyId: string, params?: { startDate?: string; endDate?: string }): Promise<KioskAnalyticsSummary> => {
    const response = await apiClient.get<{ success: boolean; data: KioskAnalyticsSummary }>(`/kiosk/journeys/${journeyId}/analytics`, { params });
    return response.data.data;
  },

  toggleMaintenanceMode: async (deviceId: string, maintenance: boolean): Promise<KioskDevice> => {
    const response = await apiClient.patch<{ success: boolean; data: KioskDevice }>(`/kiosk/devices/${deviceId}/maintenance`, { maintenance });
    return response.data.data;
  },

  identifyFrontlineWorker: async (identifier: string, kioskDeviceId?: string): Promise<{ token: string; user: any; pendingComplianceDocsCount: number }> => {
    const response = await apiClient.post<{ success: boolean; data: any }>('/kiosk/identify', { identifier, kioskDeviceId });
    return response.data.data;
  },


  setSupervisorPin: async (supervisorId: string, pin: string): Promise<boolean> => {
    const response = await apiClient.post<{ success: boolean; message: string }>('/kiosk/supervisor/pin', {
      supervisorId,
      supervisorIdentifier: supervisorId,
      pin,
    });
    return response.data.success;
  },

  // --- Device Groups & Site Rules (K-ASN-003) ---
  getDeviceGroups: async (params?: { siteId?: string; search?: string }): Promise<KioskDeviceGroup[]> => {
    const response = await apiClient.get<{ success: boolean; data: KioskDeviceGroup[] }>('/kiosk/groups', { params });
    return response.data.data;
  },

  getDeviceGroupById: async (id: string): Promise<KioskDeviceGroup> => {
    const response = await apiClient.get<{ success: boolean; data: KioskDeviceGroup }>(`/kiosk/groups/${id}`);
    return response.data.data;
  },

  createDeviceGroup: async (data: { name: string; description?: string; siteId?: string; deviceIds?: string[] }): Promise<KioskDeviceGroup> => {
    const response = await apiClient.post<{ success: boolean; data: KioskDeviceGroup }>('/kiosk/groups', data);
    return response.data.data;
  },

  updateDeviceGroup: async (id: string, data: Partial<{ name: string; description?: string; siteId?: string; deviceIds?: string[] }>): Promise<KioskDeviceGroup> => {
    const response = await apiClient.put<{ success: boolean; data: KioskDeviceGroup }>(`/kiosk/groups/${id}`, data);
    return response.data.data;
  },

  deleteDeviceGroup: async (id: string): Promise<void> => {
    await apiClient.delete(`/kiosk/groups/${id}`);
  },

  getGroupAssignments: async (id: string): Promise<any[]> => {
    const response = await apiClient.get<{ success: boolean; data: any[] }>(`/kiosk/groups/${id}/assignments`);
    return response.data.data;
  },

  setGroupAssignments: async (id: string, payload: any): Promise<any[]> => {
    const response = await apiClient.post<{ success: boolean; data: any[] }>(`/kiosk/groups/${id}/assignments`, payload);
    return response.data.data;
  },

  // --- Ephemeral Session Lifecycle API (K-EMP-002) ---

  createSession: async (data: {
    deviceId: string;
    journeyId: string;
    journeyVersionId?: string | null;
    versionNumber?: number;
    userId?: string | null;
    organizationId?: string;
    currentStepId?: string;
  }): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.post<{ success: boolean; data: KioskSession }>(
      '/kiosk/sessions',
      data,
      { headers }
    );
    return response.data.data;
  },

  updateSessionProgress: async (
    sessionId: string,
    data: {
      stepId?: string;
      currentStepId?: string;
      completedStepId?: string;
      completedStepIds?: string[];
      durationIncrement?: number;
      durationSeconds?: number;
      ppeItemsVerified?: string[];
      timestamp?: number;
      sessionStartTime?: number;
      monotonicElapsedMs?: number;
      hmacSignature?: string;
    }
  ): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.patch<{ success: boolean; data: KioskSession }>(
      `/kiosk/sessions/${sessionId}/progress`,
      data,
      { headers }
    );
    return response.data.data;
  },

  completeSession: async (
    sessionId: string,
    data?: {
      durationSeconds?: number;
      quizScore?: number;
      ppeItemsVerified?: string[];
      verificationChecksum?: string;
      completedStepIds?: string[];
      completedStepId?: string;
    }
  ): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.post<{ success: boolean; data: KioskSession }>(
      `/kiosk/sessions/${sessionId}/complete`,
      data || {},
      { headers }
    );
    return response.data.data;
  },

  abortSession: async (
    sessionId: string,
    data?: {
      abortedStepId?: string;
      reason?: string;
      durationSeconds?: number;
    }
  ): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.post<{ success: boolean; data: KioskSession }>(
      `/kiosk/sessions/${sessionId}/abort`,
      data || {},
      { headers }
    );
    return response.data.data;
  },

  timeoutSession: async (
    sessionId: string,
    data?: {
      abortedStepId?: string;
      reason?: string;
      durationSeconds?: number;
    }
  ): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.post<{ success: boolean; data: KioskSession }>(
      `/kiosk/sessions/${sessionId}/timeout`,
      data || {},
      { headers }
    );
    return response.data.data;
  },

  getSession: async (sessionId: string): Promise<KioskSession> => {
    const headers: Record<string, string> = {};
    const employeeToken = deviceIdentityService.getEmployeeToken();
    if (employeeToken) {
      headers.Authorization = `Bearer ${employeeToken}`;
    }
    const response = await apiClient.get<{ success: boolean; data: KioskSession }>(
      `/kiosk/sessions/${sessionId}`,
      { headers }
    );
    return response.data.data;
  },

  // --- Emergency Kiosk Mode Override (K-SEC-004) ---
  broadcastEmergency: async (payload: EmergencyBroadcastPayload): Promise<KioskEmergency> => {
    const response = await apiClient.post<{ success: boolean; data: KioskEmergency }>('/kiosk/emergency/broadcast', payload);
    return response.data.data;
  },

  clearEmergency: async (payload?: EmergencyClearPayload): Promise<void> => {
    await apiClient.post('/kiosk/emergency/clear', payload || {});
  },

  getEmergencyStatus: async (organizationId?: string): Promise<KioskEmergency | null> => {
    const response = await apiClient.get<{ success: boolean; data: KioskEmergency | null; emergency: KioskEmergency | null }>('/kiosk/emergency/status', {
      params: organizationId ? { organizationId } : undefined
    });
    return response.data.emergency || response.data.data || null;
  },

  // --- K-ANA-003: Safety Compliance Reporting & Audit Packet ---
  getComplianceSummary: async (params?: ComplianceFilterParams): Promise<KioskComplianceSummary> => {
    const response = await apiClient.get<{ success: boolean; data: KioskComplianceSummary }>('/kiosk/compliance/summary', { params });
    return response.data.data;
  },

  getComplianceByDepartment: async (params?: ComplianceFilterParams): Promise<DepartmentComplianceResponse> => {
    const response = await apiClient.get<{ success: boolean; data: DepartmentComplianceResponse }>('/kiosk/compliance/by-department', { params });
    return response.data.data;
  },

  exportComplianceReport: async (params?: ComplianceFilterParams): Promise<{ blob: Blob; filename: string }> => {
    const response = await apiClient.get('/kiosk/compliance/export', {
      params,
      responseType: 'blob'
    });
    const disposition = (response.headers as any)?.['content-disposition'] || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `compliance-audit-packet-${Date.now()}.csv`;
    return { blob: response.data, filename };
  }
};
