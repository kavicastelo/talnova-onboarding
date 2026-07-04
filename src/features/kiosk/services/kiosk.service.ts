import { apiClient } from '../../../api/client';
import { KioskJourney } from '../../../types/kiosk/journey.types';
import { KioskDevice, KioskTelemetry, KioskCommand } from '../../../types/kiosk/device.types';
import { KioskAnalytics, KioskAnalyticsSummary } from '../../../types/kiosk/analytics.types';

export const kioskService = {
  // --- Journey Builder API ---
  createJourney: async (payload: Partial<KioskJourney>): Promise<KioskJourney> => {
    const { _id, organizationId, createdAt, updatedAt, createdBy, updatedBy, isDeleted, deletedAt, __v, ...cleanPayload } = payload as any;
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>('/kiosk/journeys', cleanPayload);
    return response.data.data;
  },

  getJourney: async (id: string): Promise<KioskJourney> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}`);
    return response.data.data;
  },

  updateJourney: async (id: string, payload: Partial<KioskJourney>): Promise<KioskJourney> => {
    const { _id, organizationId, createdAt, updatedAt, createdBy, updatedBy, isDeleted, deletedAt, __v, ...cleanPayload } = payload as any;
    const response = await apiClient.put<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}`, cleanPayload);
    return response.data.data;
  },

  deleteJourney: async (id: string): Promise<void> => {
    await apiClient.delete(`/kiosk/journeys/${id}`);
  },

  publishJourney: async (id: string): Promise<KioskJourney> => {
    const response = await apiClient.post<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/${id}/publish`);
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
  pairDevice: async (payload: { code: string; deviceId: string; name: string; location: string }): Promise<{ device: KioskDevice; token: string }> => {
    const response = await apiClient.post<{ success: boolean; data: { device: KioskDevice; token: string } }>('/kiosk/devices/pair', payload);
    return response.data.data;
  },

  generatePairingCode: async (deviceId: string): Promise<string> => {
    const response = await apiClient.post<{ success: boolean; data: { code: string } }>('/kiosk/devices/pair/code', { deviceId });
    return response.data.data.code;
  },

  heartbeat: async (payload: { currentContentVersion: number; telemetry: KioskTelemetry }): Promise<{ status: string; pendingCommands: KioskCommand[] }> => {
    const response = await apiClient.post<{ success: boolean; data: { status: string; pendingCommands: KioskCommand[] } }>('/kiosk/devices/heartbeat', payload);
    return response.data.data;
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

  // --- Player & Playback ---
  verifyPin: async (journeyId: string, pinCode: string): Promise<boolean> => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`/kiosk/journeys/${journeyId}/auth/pin`, { pinCode });
    return response.data.success;
  },

  syncAnalytics: async (sessions: Partial<KioskAnalytics>[]): Promise<any> => {
    const response = await apiClient.post<{ success: boolean; data: any }>('/kiosk/analytics/sync', { sessions });
    return response.data.data;
  },

  getPublicPlaybackJourney: async (journeyId: string, queryParams: { o: string; exp: string; sig: string }): Promise<KioskJourney> => {
    const response = await apiClient.get<{ success: boolean; data: KioskJourney }>(`/kiosk/journeys/play/${journeyId}`, { params: queryParams });
    return response.data.data;
  },

  getJourneyAnalytics: async (journeyId: string, params?: { startDate?: string; endDate?: string }): Promise<KioskAnalyticsSummary> => {
    const response = await apiClient.get<{ success: boolean; data: KioskAnalyticsSummary }>(`/kiosk/journeys/${journeyId}/analytics`, { params });
    return response.data.data;
  }
};
