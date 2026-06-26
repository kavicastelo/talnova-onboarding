import { apiClient } from '../api/client';
import { Journey, ApiResponse } from '../types';

export const journeyService = {
  getJourneys: async (): Promise<Journey[]> => {
    const response = await apiClient.get<ApiResponse<Journey[]>>('/journeys');
    return response.data.data;
  },

  getJourney: async (id: string): Promise<Journey> => {
    const response = await apiClient.get<ApiResponse<Journey>>(`/journeys/${id}`);
    return response.data.data;
  },

  createJourney: async (journey: Partial<Journey>): Promise<Journey> => {
    const response = await apiClient.post<ApiResponse<Journey>>('/journeys', journey);
    return response.data.data;
  },

  updateJourney: async (id: string, journey: Partial<Journey>): Promise<Journey> => {
    const response = await apiClient.put<ApiResponse<Journey>>(`/journeys/${id}`, journey);
    return response.data.data;
  },

  deleteJourney: async (id: string): Promise<void> => {
    await apiClient.delete(`/journeys/${id}`);
  },

  assignJourney: async (journeyId: string, employeeId: string): Promise<void> => {
    await apiClient.post(`/journeys/${journeyId}/assign`, { employeeId });
  }
};
