import React from 'react';
import { useTranslation } from 'react-i18next';
import { MeetingEvent } from '../../services/calendar.service';
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  ExternalLink,
  Users,
  FileText,
  Download,
  Plus,
  MessageSquare
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter
} from '../Dialog';
import { Button } from '../Button';
import { Badge } from '../Badge';

interface DayAgendaModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: MeetingEvent[];
  employees: any[];
  isManager: boolean;
  getCategoryLabel: (category: string) => string;
  onScheduleForDay: (date: Date) => void;
  onOpenNotes: (event: MeetingEvent) => void;
  onDownloadIcs: (event: MeetingEvent) => void;
  onCancelMeeting: (eventId: string) => void;
}

export const DayAgendaModal: React.FC<DayAgendaModalProps> = ({
  isOpen,
  onClose,
  date,
  events,
  employees,
  isManager,
  getCategoryLabel,
  onScheduleForDay,
  onOpenNotes,
  onDownloadIcs,
  onCancelMeeting,
}) => {
  const { t } = useTranslation(['integrations', 'common']);

  if (!date) return null;

  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const dayEvents = (events || []).filter((ev) => {
    const evDate = new Date(ev.startTime);
    return (
      evDate.getFullYear() === date.getFullYear() &&
      evDate.getMonth() === date.getMonth() &&
      evDate.getDate() === date.getDate()
    );
  });

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'manager_1on1':
        return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'buddy_coffee':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'orientation':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'training':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default:
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
    }
  };

  const getAttendeeNames = (attendeeIds: any[]) => {
    if (!attendeeIds || attendeeIds.length === 0) return [];
    return attendeeIds.map((id) => {
      const rawId = typeof id === 'object' ? id._id || id.id : id;
      const emp = employees.find((e) => e.id === rawId || e._id === rawId);
      if (emp) {
        return emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || emp.email;
      }
      return typeof id === 'object' && id.name ? id.name : 'Team Member';
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-600" />
            <DialogTitle>
              {t('calendar.agendaDrawer.title', { date: formattedDate, defaultValue: `Agenda for ${formattedDate}` })}
            </DialogTitle>
          </div>
          <DialogDescription>
            {t('calendar.agendaDrawer.desc', {
              defaultValue: 'All 1-on-1 check-ins, coffee chats, and orientation sessions on this date.',
            })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 overflow-y-auto flex-1 py-4">
          {dayEvents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-xl my-4">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-semibold text-sm">
                {t('calendar.agendaDrawer.noMeetings', 'No onboarding meetings scheduled for this day.')}
              </p>
              {isManager && (
                <Button
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
                  onClick={() => onScheduleForDay(date)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  {t('calendar.agendaDrawer.scheduleForDay', 'Schedule Meeting on This Day')}
                </Button>
              )}
            </div>
          ) : (
            dayEvents.map((ev) => {
              const startStr = new Date(ev.startTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const endStr = new Date(ev.endTime).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              const attendeeNames = getAttendeeNames(ev.attendeeUserIds);

              return (
                <div
                  key={ev._id}
                  data-testid="agenda-event-card"
                  className="p-4 border rounded-xl bg-card hover:bg-muted/10 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm text-foreground">{ev.title}</h4>
                      <Badge variant="outline" className={`text-[10px] ${getCategoryStyles(ev.category)}`}>
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

                    <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{startStr} – {endStr}</span>
                    </div>
                  </div>

                  {ev.description && (
                    <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/40">
                      <span className="font-semibold text-foreground">{t('calendar.roster.agendaLabel', 'Agenda:')}</span> {ev.description}
                    </p>
                  )}

                  {ev.notes && (
                    <div className="text-xs text-indigo-900 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-200 dark:border-indigo-800/50 flex items-start gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-indigo-600 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-semibold">{t('calendar.roster.notesLabel', 'Discussion Notes:')}</span> {ev.notes}
                      </div>
                    </div>
                  )}

                  {/* Attendees */}
                  {attendeeNames.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground mr-1">Participants:</span>
                      {attendeeNames.map((name, i) => (
                        <span
                          key={i}
                          className="bg-muted px-2 py-0.5 rounded-md text-[11px] text-foreground font-medium"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      {ev.locationUrl && (
                        <a
                          href={ev.locationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline"
                        >
                          <Video className="h-3.5 w-3.5" />
                          {t('calendar.roster.joinVideoCall', 'Join Video Call')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 px-2"
                        onClick={() => onDownloadIcs(ev)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        {t('calendar.roster.downloadIcs', 'Download .ics')}
                      </Button>

                      {isManager && ev.status !== 'cancelled' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 px-2 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 border-indigo-200"
                          onClick={() => onOpenNotes(ev)}
                        >
                          <FileText className="h-3 w-3 mr-1" />
                          {ev.notes ? t('calendar.roster.editNotes', 'Edit Notes') : t('calendar.roster.addNotes', 'Add Notes')}
                        </Button>
                      )}

                      {isManager && ev.status !== 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-red-600 hover:text-red-700"
                          onClick={() => onCancelMeeting(ev._id)}
                        >
                          {t('calendar.roster.cancelMeeting', 'Cancel')}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </DialogBody>

        <DialogFooter className="border-t pt-3 flex flex-row items-center justify-between">
          {isManager ? (
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              onClick={() => onScheduleForDay(date)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t('calendar.agendaDrawer.scheduleForDay', 'Schedule Another Meeting')}
            </Button>
          ) : (
            <div />
          )}

          <Button variant="outline" size="sm" onClick={onClose}>
            {t('calendar.agendaDrawer.close', 'Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DayAgendaModal;
