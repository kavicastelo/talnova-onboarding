import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { CalendarMonthGrid } from '../components/calendar/CalendarMonthGrid';
import { CalendarWeekView } from '../components/calendar/CalendarWeekView';
import { DayAgendaModal } from '../components/calendar/DayAgendaModal';
import { MeetingEvent } from '../services/calendar.service';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValOrOptions?: any) => {
      if (typeof defaultValOrOptions === 'string') return defaultValOrOptions;
      if (typeof defaultValOrOptions === 'object' && defaultValOrOptions?.defaultValue) {
        let val = defaultValOrOptions.defaultValue;
        if (defaultValOrOptions.count !== undefined) val = val.replace('{{count}}', String(defaultValOrOptions.count));
        if (defaultValOrOptions.date !== undefined) val = val.replace('{{date}}', String(defaultValOrOptions.date));
        return val;
      }
      // Fallback translations for standard keys
      const fallbacks: Record<string, string> = {
        'calendar.weekdays.sun': 'Sun',
        'calendar.weekdays.mon': 'Mon',
        'calendar.weekdays.tue': 'Tue',
        'calendar.weekdays.wed': 'Wed',
        'calendar.weekdays.thu': 'Thu',
        'calendar.weekdays.fri': 'Fri',
        'calendar.weekdays.sat': 'Sat',
        'calendar.nav.today': 'Today',
        'calendar.roster.empty': 'No meetings',
        'calendar.roster.joinVideoCall': 'Join Video Call',
        'calendar.roster.downloadIcs': 'Download .ics',
        'calendar.roster.editNotes': 'Edit Notes',
        'calendar.roster.addNotes': 'Add Notes',
        'calendar.roster.cancelMeeting': 'Cancel',
        'calendar.roster.agendaLabel': 'Agenda:',
        'calendar.roster.notesLabel': 'Discussion Notes:',
        'calendar.agendaDrawer.noMeetings': 'No onboarding meetings scheduled for this day.',
        'calendar.agendaDrawer.scheduleForDay': 'Schedule Meeting on This Day',
        'calendar.agendaDrawer.close': 'Close',
      };
      return fallbacks[key] || key;
    },
  }),
}));

describe('Phase 2 — Visual Calendar Grid & Day Agenda Component Test Suite', () => {
  const mockEvents: MeetingEvent[] = [
    {
      _id: 'ev-1',
      title: 'Manager 1-on-1 Kickoff',
      description: 'Review first sprint objectives',
      category: 'manager_1on1',
      organizerUserId: 'usr-1',
      attendeeUserIds: ['usr-1', 'usr-2'],
      startTime: '2026-10-15T10:00:00.000Z',
      endTime: '2026-10-15T10:30:00.000Z',
      timezone: 'UTC',
      locationUrl: 'https://meet.google.com/tal-abc-def',
      status: 'scheduled',
      notes: 'Setup completed on schedule.',
      iCalUid: 'uid-1@talnova.app',
    },
    {
      _id: 'ev-2',
      title: 'Buddy Welcome Coffee',
      category: 'buddy_coffee',
      organizerUserId: 'usr-1',
      attendeeUserIds: ['usr-1', 'usr-3'],
      startTime: '2026-10-15T14:00:00.000Z',
      endTime: '2026-10-15T14:30:00.000Z',
      timezone: 'UTC',
      locationUrl: 'https://meet.google.com/tal-cof-fee',
      status: 'scheduled',
      iCalUid: 'uid-2@talnova.app',
    },
    {
      _id: 'ev-3',
      title: 'Engineering Architecture Orientation',
      category: 'orientation',
      organizerUserId: 'usr-1',
      attendeeUserIds: ['usr-1', 'usr-2', 'usr-4'],
      startTime: '2026-10-15T15:00:00.000Z',
      endTime: '2026-10-15T16:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      iCalUid: 'uid-3@talnova.app',
    },
    {
      _id: 'ev-4',
      title: 'Security Compliance Training',
      category: 'training',
      organizerUserId: 'usr-1',
      attendeeUserIds: ['usr-1', 'usr-2'],
      startTime: '2026-10-15T16:30:00.000Z',
      endTime: '2026-10-15T17:00:00.000Z',
      timezone: 'UTC',
      status: 'scheduled',
      iCalUid: 'uid-4@talnova.app',
    },
    {
      _id: 'ev-5',
      title: 'HR Benefits Overview',
      category: 'custom',
      organizerUserId: 'usr-1',
      attendeeUserIds: ['usr-1', 'usr-2'],
      startTime: '2026-10-16T11:00:00.000Z',
      endTime: '2026-10-16T11:30:00.000Z',
      timezone: 'UTC',
      status: 'cancelled',
      iCalUid: 'uid-5@talnova.app',
    },
  ];

  const mockEmployees = [
    { id: 'usr-1', name: 'Sarah Manager', email: 'sarah@talnova.com' },
    { id: 'usr-2', name: 'Alex NewHire', email: 'alex@talnova.com' },
    { id: 'usr-3', name: 'Taylor Buddy', email: 'taylor@talnova.com' },
    { id: 'usr-4', name: 'David Mentor', email: 'david@talnova.com' },
  ];

  const getCategoryLabel = (c: string) => c.replace('_', ' ').toUpperCase();

  describe('1. CalendarMonthGrid Component', () => {
    it('should render weekday headers and calendar grid cells', () => {
      const targetDate = new Date('2026-10-15T12:00:00.000Z');
      const html = renderToString(
        <CalendarMonthGrid
          currentDate={targetDate}
          events={mockEvents}
          onSelectDate={() => {}}
          onSelectEvent={() => {}}
          getCategoryLabel={getCategoryLabel}
        />
      );

      // Check weekdays
      expect(html).toContain('Sun');
      expect(html).toContain('Mon');
      expect(html).toContain('Fri');
      expect(html).toContain('data-testid="calendar-month-grid"');

      // Check events on Oct 15
      expect(html).toContain('Manager 1-on-1 Kickoff');
      expect(html).toContain('Buddy Welcome Coffee');
      expect(html).toContain('Engineering Architecture Orientation');

      // 4 events on Oct 15 means "+1 more" should be displayed
      expect(html).toContain('+1 more');

      // Cancelled event on Oct 16 has strikethrough class
      expect(html).toContain('HR Benefits Overview');
      expect(html).toContain('line-through');
    });
  });

  describe('2. CalendarWeekView Component', () => {
    it('should render 7 column cards for the week and display events with times and links', () => {
      const targetDate = new Date('2026-10-15T12:00:00.000Z');
      const html = renderToString(
        <CalendarWeekView
          currentDate={targetDate}
          events={mockEvents}
          onSelectDate={() => {}}
          onSelectEvent={() => {}}
          getCategoryLabel={getCategoryLabel}
          isManager={true}
          onQuickSchedule={() => {}}
        />
      );

      expect(html).toContain('data-testid="calendar-week-view"');
      expect(html).toContain('Manager 1-on-1 Kickoff');
      expect(html).toContain('https://meet.google.com/tal-abc-def');
      expect(html).toContain('Buddy Welcome Coffee');
      expect(html).toContain('No meetings'); // empty days in the week
    });
  });

  describe('3. DayAgendaModal Component', () => {
    it('should render full meeting details, attendee names, and action buttons for selected date', () => {
      const selectedDate = new Date('2026-10-15T12:00:00.000Z');
      const html = renderToString(
        <DayAgendaModal
          isOpen={true}
          onClose={() => {}}
          date={selectedDate}
          events={mockEvents}
          employees={mockEmployees}
          isManager={true}
          getCategoryLabel={getCategoryLabel}
          onScheduleForDay={() => {}}
          onOpenNotes={() => {}}
          onDownloadIcs={() => {}}
          onCancelMeeting={() => {}}
        />
      );

      expect(html).toContain('Manager 1-on-1 Kickoff');
      expect(html).toContain('Review first sprint objectives');
      expect(html).toContain('Setup completed on schedule.');
      expect(html).toContain('Sarah Manager');
      expect(html).toContain('Alex NewHire');
      expect(html).toContain('Join Video Call');
      expect(html).toContain('Download .ics');
      expect(html).toContain('Edit Notes');
      expect(html).toContain('Schedule Another Meeting');
    });

    it('should render empty state message when date has no meetings', () => {
      const emptyDate = new Date('2026-10-20T12:00:00.000Z');
      const html = renderToString(
        <DayAgendaModal
          isOpen={true}
          onClose={() => {}}
          date={emptyDate}
          events={mockEvents}
          employees={mockEmployees}
          isManager={true}
          getCategoryLabel={getCategoryLabel}
          onScheduleForDay={() => {}}
          onOpenNotes={() => {}}
          onDownloadIcs={() => {}}
          onCancelMeeting={() => {}}
        />
      );

      expect(html).toContain('No onboarding meetings scheduled for this day.');
      expect(html).toContain('Schedule Meeting on This Day');
    });
  });
});
