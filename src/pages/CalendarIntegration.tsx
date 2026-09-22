import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar as CalendarIcon,
  Video,
  Clock,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Globe,
  FileText,
  Download,
  AlertCircle,
  MessageSquare,
  Users,
  X,
  Sparkles,
  LayoutGrid,
  CalendarRange,
  List as ListIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  useCalendarConnection,
  useMeetingEvents,
  useCreateMeetingEvent,
  usePatchMeetingEvent,
  useCancelMeetingEvent,
  useCalendarAvailability
} from '../hooks/useCalendar';
import calendarService, { MeetingEvent } from '../services/calendar.service';
import { useRole } from '../context/RoleContext';
import { useEmployees } from '../hooks/useEmployees';
import { Button } from '../components/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/Card';
import { Badge } from '../components/Badge';
import { Input } from '../components/Input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '../components/Dialog';
import { toast } from 'sonner';
import { SimplePagination } from '../components/SimplePagination';
import { SearchableSelect } from '../components/SearchableSelect';
import { usePagination } from '../hooks/usePagination';
import { CalendarMonthGrid } from '../components/calendar/CalendarMonthGrid';
import { CalendarWeekView } from '../components/calendar/CalendarWeekView';
import { DayAgendaModal } from '../components/calendar/DayAgendaModal';

export const CalendarIntegration: React.FC = () => {
  const { t } = useTranslation(['integrations', 'common']);
  const { role } = useRole();
  const isManager = role === 'manager' || role === 'admin' || role === 'owner' || role === 'hr_admin' || role === 'super_admin';

  // Calendar View State (Phase 2)
  const [viewMode, setViewMode] = useState<'grid' | 'week' | 'list'>('grid');
  const [currentViewDate, setCurrentViewDate] = useState<Date>(new Date());
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date | null>(null);
  const [isAgendaModalOpen, setIsAgendaModalOpen] = useState(false);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [selectedEventForNotes, setSelectedEventForNotes] = useState<MeetingEvent | null>(null);
  const [notesText, setNotesText] = useState('');
  const [copied, setCopied] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'manager_1on1' | 'buddy_coffee' | 'orientation' | 'training' | 'custom'>('manager_1on1');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('10:30');
  const [locationUrl, setLocationUrl] = useState('https://meet.google.com/talnova-onboarding');
  const [selectedAttendeeIds, setSelectedAttendeeIds] = useState<string[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState('');
  const [agenda, setAgenda] = useState('');
  const [validationError, setValidationError] = useState('');

  const { data: connection } = useCalendarConnection();
  const { data: events, isLoading: eventsLoading, refetch: refetchEvents } = useMeetingEvents();
  const { data: employeesData } = useEmployees({ page: 1, limit: 1000 });

  const { data: availabilityData, isLoading: availabilityLoading } = useCalendarAvailability({
    userIds: selectedAttendeeIds,
    date: startDate,
    durationMinutes: 30,
  });

  const activeConflict = useMemo(() => {
    if (!availabilityData?.allSlots || !startDate || !startTime || !endTime) return null;
    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${startDate}T${endTime}:00`).toISOString();

    for (const slot of availabilityData.allSlots) {
      if (slot.conflicts && slot.conflicts.length > 0) {
        if (startISO < slot.endTime && endISO > slot.startTime) {
          return slot.conflicts[0];
        }
      }
    }
    return null;
  }, [availabilityData, startDate, startTime, endTime]);

  const handleAddAttendee = (empId: string) => {
    if (!empId) return;
    if (!selectedAttendeeIds.includes(empId)) {
      setSelectedAttendeeIds((prev) => [...prev, empId]);
    }
    setSelectedAttendeeId('');
  };

  const handleRemoveAttendee = (empId: string) => {
    setSelectedAttendeeIds((prev) => prev.filter((id) => id !== empId));
  };

  const eventsPagination = usePagination({ data: events || [], initialPageSize: 10 });

  const createEventMutation = useCreateMeetingEvent();
  const patchEventMutation = usePatchMeetingEvent();
  const cancelEventMutation = useCancelMeetingEvent();

  const employees = employeesData?.employees || [];
  const icalFeedUrl = `${window.location.origin}/api/v1/calendar/feed/${connection?.icalToken || 'token'}.ics`;

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      manager_1on1: t('calendar.categories.manager_1on1', 'Manager 1-on-1'),
      buddy_coffee: t('calendar.categories.buddy_coffee', 'Buddy Welcome Coffee'),
      orientation: t('calendar.categories.orientation', 'Orientation Session'),
      training: t('calendar.categories.training', 'Technical Training'),
      custom: t('calendar.categories.custom', 'Custom Meeting'),
    };
    return map[cat] || cat.replace('_', ' ').toUpperCase();
  };

  const handlePrev = () => {
    setCurrentViewDate((prev) => {
      if (viewMode === 'grid') {
        return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      }
      return new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000);
    });
  };

  const handleNext = () => {
    setCurrentViewDate((prev) => {
      if (viewMode === 'grid') {
        return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      }
      return new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000);
    });
  };

  const handleToday = () => {
    setCurrentViewDate(new Date());
  };

  const handleSelectDateForAgenda = (date: Date) => {
    setSelectedAgendaDate(date);
    setIsAgendaModalOpen(true);
  };

  const handleQuickScheduleForDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    setStartDate(`${y}-${m}-${d}`);
    setValidationError('');
    setIsScheduleModalOpen(true);
    setIsAgendaModalOpen(false);
  };

  const viewTitle = useMemo(() => {
    if (viewMode === 'grid') {
      return currentViewDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'week') {
      const current = new Date(currentViewDate);
      const dayOfWeek = current.getDay();
      const startOfWeek = new Date(current);
      startOfWeek.setDate(current.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const startMonth = startOfWeek.toLocaleDateString(undefined, { month: 'short' });
      const endMonth = endOfWeek.toLocaleDateString(undefined, { month: 'short' });

      if (startMonth === endMonth) {
        return `${startMonth} ${startOfWeek.getDate()} – ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
      }
      return `${startMonth} ${startOfWeek.getDate()} – ${endMonth} ${endOfWeek.getDate()}, ${endOfWeek.getFullYear()}`;
    }
    return t('calendar.roster.title', 'Scheduled Onboarding Meetings');
  }, [viewMode, currentViewDate, t]);

  const handleScheduleMeeting = () => {
    setValidationError('');

    if (!title.trim() || !startDate || selectedAttendeeIds.length === 0) {
      const err = t('calendar.validation.requiredFields', 'Please complete all required fields.');
      setValidationError(err);
      toast.error(err);
      return;
    }

    const startISO = new Date(`${startDate}T${startTime}:00`).toISOString();
    const endISO = new Date(`${startDate}T${endTime}:00`).toISOString();

    if (new Date(endISO) <= new Date(startISO)) {
      const err = t('calendar.validation.endTimeAfterStart', 'End time must be after start time');
      setValidationError(err);
      toast.error(err);
      return;
    }

    createEventMutation.mutate(
      {
        title: title.trim(),
        description: agenda.trim() || undefined,
        category,
        attendeeUserIds: selectedAttendeeIds,
        startTime: startISO,
        endTime: endISO,
        locationUrl: locationUrl.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t('calendar.toasts.scheduledSuccess', 'Meeting scheduled successfully!'));
          setIsScheduleModalOpen(false);
          setTitle('');
          setAgenda('');
          setSelectedAttendeeIds([]);
          setSelectedAttendeeId('');
          setValidationError('');
          refetchEvents();
        },
        onError: (err: any) => {
          const errMsg = err?.response?.data?.message || err?.message || t('calendar.toasts.scheduleFailed', 'Failed to schedule meeting');
          setValidationError(errMsg);
          toast.error(errMsg);
        }
      }
    );
  };

  const handleOpenNotes = (event: MeetingEvent) => {
    setSelectedEventForNotes(event);
    setNotesText(event.notes || '');
    setIsNotesModalOpen(true);
  };

  const handleSaveNotes = () => {
    if (!selectedEventForNotes) return;

    patchEventMutation.mutate(
      {
        id: selectedEventForNotes._id,
        data: { notes: notesText.trim() },
      },
      {
        onSuccess: () => {
          toast.success(t('calendar.toasts.notesSaved', 'Discussion notes saved successfully.'));
          setIsNotesModalOpen(false);
          setSelectedEventForNotes(null);
          setNotesText('');
          refetchEvents();
        },
        onError: (err: any) => {
          toast.error(err?.response?.data?.message || err?.message || t('calendar.toasts.notesFailed', 'Failed to save notes'));
        },
      }
    );
  };

  const handleDownloadEventICal = async (event: MeetingEvent) => {
    try {
      let icsData = '';
      try {
        icsData = await calendarService.exportEventICal(event._id);
      } catch {
        // Fallback client generation if endpoint unreachable
        const formatDate = (d: string) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        icsData = [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//Talnova Onboarding//Calendar Integration//EN',
          'CALSCALE:GREGORIAN',
          'METHOD:REQUEST',
          'BEGIN:VEVENT',
          `UID:${event.iCalUid || event._id}`,
          `DTSTART:${formatDate(event.startTime)}`,
          `DTEND:${formatDate(event.endTime)}`,
          `SUMMARY:${event.title}`,
          `DESCRIPTION:${(event.description || event.notes || 'Onboarding meeting').replace(/\n/g, '\\n')}`,
          event.locationUrl ? `URL:${event.locationUrl}` : '',
          'STATUS:CONFIRMED',
          'END:VEVENT',
          'END:VCALENDAR',
        ].filter(Boolean).join('\r\n');
      }

      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${event.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('calendar.toasts.downloadedIcs', 'Downloaded calendar invitation (.ics)'));
    } catch {
      toast.error(t('calendar.toasts.downloadFailed', 'Failed to export calendar invitation'));
    }
  };

  const handleCancelMeeting = (eventId: string) => {
    if (!confirm(t('calendar.confirmCancel', 'Are you sure you want to cancel this meeting event?'))) return;
    cancelEventMutation.mutate(eventId, {
      onSuccess: () => {
        toast.success(t('calendar.toasts.cancelledSuccess', 'Meeting event cancelled.'));
        refetchEvents();
      },
      onError: (err: any) => {
        toast.error(err?.response?.data?.message || err?.message || t('calendar.toasts.cancelFailed', 'Failed to cancel meeting'));
      }
    });
  };

  const handleDownloadSchedulePack = async () => {
    try {
      const icsData = await calendarService.exportOnboardingPack();
      const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'talnova-90day-onboarding-schedule-pack.ics');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success(t('calendar.toasts.packDownloaded', 'Downloaded 90-Day Onboarding Schedule Pack (.ics)'));
    } catch {
      toast.error(t('calendar.toasts.packFailed', 'Failed to export onboarding schedule pack'));
    }
  };

  const handleAutoSuggestNextSlot = () => {
    if (!availabilityData?.availableSlots || availabilityData.availableSlots.length === 0) {
      toast.warning(t('calendar.scheduleModal.noSlotsAvailable', 'No open slots available on this date'));
      return;
    }
    const firstFree = availabilityData.availableSlots[0];
    const startHour = firstFree.startTime.substring(11, 16);
    const endHour = firstFree.endTime.substring(11, 16);
    setStartTime(startHour);
    setEndTime(endHour);
    toast.success(
      t('calendar.scheduleModal.autoSuggestSuccess', {
        time: firstFree.startFormatted,
        defaultValue: `Updated meeting time to next available mutual slot (${firstFree.startFormatted})`,
      })
    );
  };

  const handleCopyICalUrl = () => {
    navigator.clipboard.writeText(icalFeedUrl);
    setCopied(true);
    toast.success(t('calendar.toasts.copiedIcs', 'iCal Feed URL copied to clipboard!'));
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarIcon className="h-7 w-7 text-indigo-600" />
            {t('calendar.title', 'Calendar & Meeting Integration')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('calendar.subtitle', 'Connect onboarding activities to Google Calendar, Outlook, and iCal feeds with automated 1-on-1 meeting links.')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsSyncModalOpen(true)}
            data-testid="ical-sync-btn"
          >
            <Globe className="h-4 w-4 mr-2" /> {t('calendar.syncBtn', 'iCal Subscription Sync')}
          </Button>
          {isManager && (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={() => {
                setValidationError('');
                setIsScheduleModalOpen(true);
              }}
              data-testid="schedule-checkin-btn"
            >
              <Plus className="h-4 w-4 mr-2" /> {t('calendar.scheduleBtn', 'Schedule Check-in')}
            </Button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      <Card className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-6 shadow-md border-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-500 text-white text-xs font-semibold">
                {t('calendar.banner.feedActive', 'Calendar Feed Active')}
              </Badge>
              <span className="text-xs text-slate-300">
                {t('calendar.banner.timezone', 'Timezone: {{timezone}}', { timezone: connection?.timezone || 'UTC' })}
              </span>
            </div>
            <h3 className="text-lg font-bold">
              {t('calendar.banner.title', 'Synchronize Onboarding Schedule with External Calendar')}
            </h3>
            <p className="text-xs text-slate-300">
              {t('calendar.banner.desc', 'Subscribe to your personal .ics feed on Google Calendar, Apple Calendar, or Outlook.')}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs shrink-0"
              onClick={() => setIsSyncModalOpen(true)}
            >
              {t('calendar.banner.copyFeedBtn', 'Copy .ICS Feed Link')}
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0 shadow-sm"
              onClick={handleDownloadSchedulePack}
              data-testid="download-pack-btn"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t('calendar.banner.downloadPackBtn', 'Download 90-Day Schedule Pack (.ics)')}
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar View Container */}
      <Card className="shadow-sm border">
        <CardHeader className="pb-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-600" />
                <span>{viewTitle}</span>
              </CardTitle>
              <CardDescription>
                {t('calendar.roster.desc', 'Upcoming 1-on-1 syncs, buddy welcome coffees, and orientation sessions.')}
              </CardDescription>
            </div>

            {viewMode !== 'list' && (
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/50">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrev}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title={t('calendar.nav.prev', 'Previous')}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToday}
                  className="h-7 px-2 text-xs font-semibold text-foreground hover:bg-background shadow-xs"
                >
                  {t('calendar.nav.today', 'Today')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNext}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  title={t('calendar.nav.next', 'Next')}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Segmented View Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60 self-start md:self-auto">
            <button
              type="button"
              data-testid="view-month-btn"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'grid'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>{t('calendar.views.month', 'Month Grid')}</span>
            </button>
            <button
              type="button"
              data-testid="view-week-btn"
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'week'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>{t('calendar.views.week', 'Week View')}</span>
            </button>
            <button
              type="button"
              data-testid="view-list-btn"
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'list'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
              <span>{t('calendar.views.list', 'Roster List')}</span>
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {eventsLoading ? (
            <div className="p-12 text-center text-muted-foreground">
              {t('calendar.roster.loading', 'Loading calendar schedule...')}
            </div>
          ) : viewMode === 'grid' ? (
            <CalendarMonthGrid
              currentDate={currentViewDate}
              events={events || []}
              onSelectDate={handleSelectDateForAgenda}
              onSelectEvent={(ev) => {
                setSelectedAgendaDate(new Date(ev.startTime));
                setIsAgendaModalOpen(true);
              }}
              getCategoryLabel={getCategoryLabel}
            />
          ) : viewMode === 'week' ? (
            <CalendarWeekView
              currentDate={currentViewDate}
              events={events || []}
              onSelectDate={handleSelectDateForAgenda}
              onSelectEvent={(ev) => {
                setSelectedAgendaDate(new Date(ev.startTime));
                setIsAgendaModalOpen(true);
              }}
              getCategoryLabel={getCategoryLabel}
              isManager={isManager}
              onQuickSchedule={handleQuickScheduleForDate}
              onOpenNotes={handleOpenNotes}
            />
          ) : (events || []).length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              {t('calendar.roster.empty', 'No onboarding meetings scheduled.')}
            </div>
          ) : (
            <div>
              <div className="divide-y">
                {eventsPagination.paginatedData.map((ev) => (
                  <div
                    key={ev._id}
                    data-testid="meeting-event-card"
                    className="p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-muted/10 transition-colors"
                  >
                    <div className="space-y-2 max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 data-testid="event-title" className="font-semibold text-sm text-foreground">
                          {ev.title}
                        </h4>
                        <Badge
                          variant="outline"
                          className={
                            ev.category === 'manager_1on1'
                              ? 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]'
                              : ev.category === 'buddy_coffee'
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]'
                              : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]'
                          }
                        >
                          {getCategoryLabel(ev.category)}
                        </Badge>
                        {ev.status === 'cancelled' ? (
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                            {t('calendar.roster.statusCancelled', 'Cancelled')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs">
                            {t('calendar.roster.statusScheduled', 'Scheduled')}
                          </Badge>
                        )}
                      </div>

                      {ev.description && (
                        <p data-testid="event-agenda" className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-md border border-border/50">
                          <span className="font-semibold text-foreground">{t('calendar.roster.agendaLabel', 'Agenda:')}</span> {ev.description}
                        </p>
                      )}

                      {ev.notes && (
                        <div data-testid="event-notes" className="text-xs text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 p-2.5 rounded-md border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-2">
                          <MessageSquare className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-semibold">{t('calendar.roster.notesLabel', 'Discussion Notes:')}</span> {ev.notes}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-4 pt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(ev.startTime).toLocaleDateString()} ({new Date(ev.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(ev.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </span>
                        {ev.locationUrl && (
                          <a
                            href={ev.locationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-indigo-600 font-medium hover:underline"
                          >
                            <Video className="h-3.5 w-3.5" /> {t('calendar.roster.joinVideoCall', 'Join Video Call')} <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleDownloadEventICal(ev)}
                        data-testid="download-ics-btn"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" /> {t('calendar.roster.downloadIcs', 'Download .ics')}
                      </Button>

                      {isManager && ev.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 border-indigo-200"
                          onClick={() => handleOpenNotes(ev)}
                          data-testid="add-notes-btn"
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> {ev.notes ? t('calendar.roster.editNotes', 'Edit Notes') : t('calendar.roster.addNotes', 'Add Notes')}
                        </Button>
                      )}

                      {isManager && ev.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 text-xs"
                          onClick={() => handleCancelMeeting(ev._id)}
                        >
                          {t('calendar.roster.cancelMeeting', 'Cancel')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 border-t">
                <SimplePagination
                  currentPage={eventsPagination.page}
                  totalPages={eventsPagination.totalPages}
                  totalItems={eventsPagination.totalItems}
                  startIndex={eventsPagination.startIndex}
                  endIndex={eventsPagination.endIndex}
                  pageSize={eventsPagination.pageSize}
                  onPageChange={eventsPagination.setPage}
                  onPageSizeChange={eventsPagination.setPageSize}
                  itemLabel={t('calendar.roster.eventsLabel', 'events')}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Schedule 1-on-1 */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('calendar.scheduleModal.title', 'Schedule 1-on-1 Onboarding Check-in')}</DialogTitle>
            <DialogDescription>{t('calendar.scheduleModal.desc', 'Create a meeting event with direct reports, agenda, and calendar sync.')}</DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            {validationError && (
              <div
                data-testid="schedule-validation-error"
                className="p-3 text-xs bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-md border border-red-200 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('calendar.scheduleModal.meetingTitleLabel', 'Meeting Title *')}
              </label>
              <Input
                data-testid="meeting-title-input"
                placeholder={t('calendar.scheduleModal.meetingTitlePlaceholder', 'e.g. Week 1 Check-in & Feedback')}
                value={title}
                onChange={(e: any) => setTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('calendar.scheduleModal.categoryLabel', 'Category')}
                </label>
                <select
                  data-testid="meeting-category-select"
                  className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none"
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                >
                  <option value="manager_1on1">{t('calendar.categories.manager_1on1', 'Manager 1-on-1')}</option>
                  <option value="buddy_coffee">{t('calendar.categories.buddy_coffee', 'Buddy Welcome Coffee')}</option>
                  <option value="orientation">{t('calendar.categories.orientation', 'Orientation Session')}</option>
                  <option value="training">{t('calendar.categories.training', 'Technical Training')}</option>
                  <option value="custom">{t('calendar.categories.custom', 'Custom Meeting')}</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('calendar.scheduleModal.attendeesLabel', { defaultValue: 'Meeting Participants * (Min. 1 Invitee)' })}
                </label>
                <SearchableSelect
                  data-testid="attendee-select"
                  value={selectedAttendeeId}
                  onChange={(val) => handleAddAttendee(val)}
                  placeholder={t('calendar.scheduleModal.attendeePlaceholder', { defaultValue: 'Search & add invitees...' })}
                  searchPlaceholder={t('calendar.scheduleModal.attendeeSearchPlaceholder', { defaultValue: 'Search by name, email, department...' })}
                  options={employees
                    .filter((emp: any) => !selectedAttendeeIds.includes(emp.id))
                    .map((emp: any) => ({
                      value: emp.id,
                      label: emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || t('calendar.scheduleModal.unnamedAttendee', { defaultValue: 'Unnamed' }),
                      sublabel: emp.email,
                      badge: emp.department || t('calendar.scheduleModal.directReportFallback', { defaultValue: 'Team Member' }),
                    }))}
                />

                {/* Selected Participant Badges */}
                {selectedAttendeeIds.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedAttendeeIds.map((id) => {
                      const emp = employees.find((e: any) => e.id === id);
                      const name = emp?.name || `${emp?.firstName || ''} ${emp?.lastName || ''}`.trim() || 'Attendee';
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="text-xs px-2.5 py-1 flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                        >
                          <Users className="h-3 w-3" />
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAttendee(id)}
                            className="hover:text-red-500 rounded-full"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground italic mt-1 block">
                    {t('calendar.scheduleModal.selectAtLeastOne', { defaultValue: 'Add at least one team member to schedule.' })}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('calendar.scheduleModal.dateLabel', 'Date *')}
                </label>
                <Input
                  data-testid="meeting-date-input"
                  type="date"
                  value={startDate}
                  onChange={(e: any) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('calendar.scheduleModal.startTimeLabel', 'Start Time *')}
                </label>
                <Input
                  data-testid="start-time-input"
                  type="time"
                  value={startTime}
                  onChange={(e: any) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  {t('calendar.scheduleModal.endTimeLabel', 'End Time *')}
                </label>
                <Input
                  data-testid="end-time-input"
                  type="time"
                  value={endTime}
                  onChange={(e: any) => setEndTime(e.target.value)}
                />
              </div>
            </div>

            {/* Mutual Availability & Recommended Slots */}
            {startDate && selectedAttendeeIds.length > 0 && (
              <div className="p-3 border rounded-xl bg-card space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    {t('calendar.scheduleModal.availableSlotsLabel', { defaultValue: 'Recommended Mutual Free Slots' })}
                  </span>
                  {availabilityLoading ? (
                    <span className="text-[11px] text-muted-foreground">{t('common.loading', { defaultValue: 'Checking availability...' })}</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {availabilityData?.availableSlotsCount || 0} {t('calendar.scheduleModal.slotsOpen', { defaultValue: 'slots open' })}
                    </span>
                  )}
                </div>

                {availabilityData?.availableSlots && availabilityData.availableSlots.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                    {availabilityData.availableSlots.slice(0, 12).map((slot, sIdx) => {
                      const slotStartHour = slot.startTime.substring(11, 16);
                      const slotEndHour = slot.endTime.substring(11, 16);
                      const isSelected = startTime === slotStartHour && endTime === slotEndHour;
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => {
                            setStartTime(slotStartHour);
                            setEndTime(slotEndHour);
                          }}
                          className={`text-xs px-2.5 py-1 rounded-lg border font-mono transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 font-semibold shadow-sm'
                              : 'bg-background hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border-border text-foreground'
                          }`}
                        >
                          {slot.startFormatted}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  !availabilityLoading && (
                    <p className="text-xs text-muted-foreground italic">
                      {t('calendar.scheduleModal.noSlotsFound', { defaultValue: 'No mutual free slots found on this date during working hours.' })}
                    </p>
                  )
                )}
              </div>
            )}

            {/* Conflict Warning Banner */}
            {activeConflict && (
              <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 rounded-lg border border-amber-300 dark:border-amber-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="flex-1">
                  <span className="font-semibold">{t('calendar.scheduleModal.conflictDetected', { defaultValue: 'Scheduling Conflict Warning:' })}</span>
                  <p className="mt-0.5">
                    {activeConflict.busyUserNames.join(', ')} {t('calendar.scheduleModal.alreadyBookedFor', { defaultValue: 'already has a commitment:' })} "{activeConflict.title}".
                  </p>
                  <button
                    type="button"
                    onClick={handleAutoSuggestNextSlot}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-md shadow-xs transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{t('calendar.scheduleModal.autoSuggestNextSlot', { defaultValue: '⚡ Pick Earliest Mutual Free Slot' })}</span>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('calendar.scheduleModal.agendaLabel', 'Discussion Agenda')}
              </label>
              <textarea
                data-testid="meeting-agenda-input"
                rows={3}
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder={t('calendar.scheduleModal.agendaPlaceholder', 'Review dev environment setup, team channels, and questions.')}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('calendar.scheduleModal.locationLabel', 'Video Call Location Link')}
              </label>
              <Input
                data-testid="meeting-location-input"
                placeholder={t('calendar.scheduleModal.locationPlaceholder', 'https://meet.google.com/abc-defg-hij')}
                value={locationUrl}
                onChange={(e: any) => setLocationUrl(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)}>
              {t('calendar.scheduleModal.cancelBtn', 'Cancel')}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleScheduleMeeting}
              data-testid="confirm-schedule-btn"
            >
              {t('calendar.scheduleModal.confirmBtn', 'Confirm & Schedule')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Discussion Notes */}
      <Dialog open={isNotesModalOpen} onOpenChange={setIsNotesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('calendar.notesModal.title', 'Document Discussion Notes')}</DialogTitle>
            <DialogDescription>
              {t('calendar.notesModal.desc', 'Record check-in observations, blockers, and agreed next steps for {{title}}.', { title: selectedEventForNotes?.title })}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('calendar.notesModal.notesLabel', '1-on-1 Discussion Notes')}
              </label>
              <textarea
                data-testid="notes-textarea"
                rows={4}
                className="w-full text-sm p-2.5 border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder={t('calendar.notesModal.notesPlaceholder', 'Ramp on track. Discussed sprint goals.')}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
              />
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNotesModalOpen(false)}>
              {t('calendar.notesModal.cancelBtn', 'Cancel')}
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSaveNotes}
              data-testid="save-notes-btn"
            >
              {t('calendar.notesModal.saveBtn', 'Save Notes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: iCal Subscription Sync */}
      <Dialog open={isSyncModalOpen} onOpenChange={setIsSyncModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('calendar.syncModal.title', 'iCal Calendar Subscription Feed')}</DialogTitle>
            <DialogDescription>
              {t('calendar.syncModal.desc', 'Copy your personal .ics URL to subscribe in Google Calendar, Outlook, or Apple Calendar.')}
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                {t('calendar.syncModal.urlLabel', 'iCal (.ics) Feed URL')}
              </label>
              <div className="flex gap-2">
                <Input readOnly value={icalFeedUrl} className="font-mono text-xs bg-muted/30" />
                <Button variant="outline" onClick={handleCopyICalUrl}>
                  {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('calendar.syncModal.note', 'Updates made to onboarding meetings in Talnova automatically sync to your calendar.')}
            </p>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSyncModalOpen(false)}>
              {t('calendar.syncModal.closeBtn', 'Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal / Drawer: Day Agenda (Phase 2) */}
      <DayAgendaModal
        isOpen={isAgendaModalOpen}
        onClose={() => setIsAgendaModalOpen(false)}
        date={selectedAgendaDate}
        events={events || []}
        employees={employees}
        isManager={isManager}
        getCategoryLabel={getCategoryLabel}
        onScheduleForDay={handleQuickScheduleForDate}
        onOpenNotes={handleOpenNotes}
        onDownloadIcs={handleDownloadEventICal}
        onCancelMeeting={handleCancelMeeting}
      />
    </div>
  );
};

export default CalendarIntegration;
