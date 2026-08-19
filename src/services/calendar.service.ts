import { apiClient } from '../api/client';

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface CalendarConnection {
  _id: string;
  provider: 'google' | 'outlook' | 'ical';
  syncStatus: 'connected' | 'error' | 'disconnected';
  timezone: string;
  icalToken: string;
  lastSyncedAt?: string;
}

export interface MeetingEvent {
  _id: string;
  title: string;
  description?: string;
  category: 'manager_1on1' | 'buddy_coffee' | 'orientation' | 'training' | 'custom';
  organizerUserId: any;
  attendeeUserIds: any[];
  startTime: string;
  endTime: string;
  timezone: string;
  locationUrl?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  reminderMinutesBefore: number;
  iCalUid: string;
}

export const calendarService = {
  connectProvider: async (provider: 'google' | 'outlook' | 'ical', timezone: string = 'UTC'): Promise<CalendarConnection> => {
    const response = await apiClient.post<ApiResponse<CalendarConnection>>('/calendar/connection', {
      provider,
      timezone,
    });
    return response.data.data;
  },

  getConnectionStatus: async (): Promise<CalendarConnection> => {
    const response = await apiClient.get<ApiResponse<CalendarConnection>>('/calendar/connection');
    return response.data.data;
  },

  createMeetingEvent: async (data: {
    title: string;
    description?: string;
    category?: 'manager_1on1' | 'buddy_coffee' | 'orientation' | 'training' | 'custom';
    attendeeUserIds: string[];
    startTime: string;
    endTime: string;
    locationUrl?: string;
  }): Promise<MeetingEvent> => {
    const response = await apiClient.post<ApiResponse<MeetingEvent>>('/calendar/events', data);
    return response.data.data;
  },

  listMeetingEvents: async (): Promise<MeetingEvent[]> => {
    const response = await apiClient.get<ApiResponse<MeetingEvent[]>>('/calendar/events');
    return response.data.data || [];
  },

  updateMeetingEvent: async (id: string, data: Partial<MeetingEvent>): Promise<MeetingEvent> => {
    const response = await apiClient.put<ApiResponse<MeetingEvent>>(`/calendar/events/${id}`, data);
    return response.data.data;
  },

  cancelMeetingEvent: async (id: string): Promise<MeetingEvent> => {
    const response = await apiClient.delete<ApiResponse<MeetingEvent>>(`/calendar/events/${id}`);
    return response.data.data;
  },
};

export default calendarService;
