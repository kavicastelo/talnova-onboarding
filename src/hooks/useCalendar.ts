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

export function useCalendarAvailability(params: {
  userIds: string[];
  date: string;
  durationMinutes?: number;
  timezone?: string;
}) {
  return useQuery({
    queryKey: ['calendarAvailability', params.userIds, params.date, params.durationMinutes, params.timezone],
    queryFn: () => calendarService.getAvailability(params),
    enabled: Boolean(params.userIds && params.userIds.length > 0 && params.date),
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

export function usePatchMeetingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeetingEvent> }) =>
      calendarService.patchMeetingEvent(id, data),
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

export function useScheduleMilestoneReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      milestoneId,
      data,
    }: {
      milestoneId: string;
      data?: { targetDate?: string; startTime?: string; durationMinutes?: number; locationUrl?: string };
    }) => calendarService.scheduleMilestoneReview(milestoneId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetingEvents'] });
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['employeeMilestones'] });
    },
  });
}

