import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import calendarService, { MeetingEvent } from '../services/calendar.service';

export function useCalendarConnection() {
  return useQuery({
    queryKey: ['calendarConnection'],
    queryFn: () => calendarService.getConnectionStatus(),
  });
}

export function useMeetingEvents() {
  return useQuery({
    queryKey: ['meetingEvents'],
    queryFn: () => calendarService.listMeetingEvents(),
  });
}

export function useConnectCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, timezone }: { provider: 'google' | 'outlook' | 'ical'; timezone?: string }) =>
      calendarService.connectProvider(provider, timezone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarConnection'] });
    },
  });
}

export function useCreateMeetingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      category?: 'manager_1on1' | 'buddy_coffee' | 'orientation' | 'training' | 'custom';
      attendeeUserIds: string[];
      startTime: string;
      endTime: string;
      locationUrl?: string;
    }) => calendarService.createMeetingEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingEvents'] });
    },
  });
}

export function useUpdateMeetingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeetingEvent> }) =>
      calendarService.updateMeetingEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingEvents'] });
    },
  });
}

export function useCancelMeetingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calendarService.cancelMeetingEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingEvents'] });
    },
  });
}
