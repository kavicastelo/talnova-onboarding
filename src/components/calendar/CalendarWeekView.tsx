import React from 'react';
import { useTranslation } from 'react-i18next';
import { MeetingEvent } from '../../services/calendar.service';
import { Clock, Video, Users, Plus, ExternalLink, FileText } from 'lucide-react';
import { Badge } from '../Badge';

interface CalendarWeekViewProps {
  currentDate: Date;
  events: MeetingEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: MeetingEvent) => void;
  getCategoryLabel: (category: string) => string;
  isManager: boolean;
  onQuickSchedule: (date: Date) => void;
  onOpenNotes?: (event: MeetingEvent) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  events,
  onSelectDate,
  onSelectEvent,
  getCategoryLabel,
  isManager,
  onQuickSchedule,
  onOpenNotes,
}) => {
  const { t } = useTranslation(['integrations', 'common']);

  // Calculate the 7 days of the week containing currentDate (Sunday to Saturday)
  const weekDays = React.useMemo(() => {
    const days: Date[] = [];
    const current = new Date(currentDate);
    const dayOfWeek = current.getDay(); // 0 = Sun
    const startOfWeek = new Date(current);
    startOfWeek.setDate(current.getDate() - dayOfWeek);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const today = new Date();
  const isToday = (d: Date) => {
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const getEventsForDay = (day: Date) => {
    const y = day.getFullYear();
    const m = day.getMonth();
    const d = day.getDate();
    return (events || []).filter((ev) => {
      const evDate = new Date(ev.startTime);
      return evDate.getFullYear() === y && evDate.getMonth() === m && evDate.getDate() === d;
    });
  };

  const weekdayNames = [
    t('calendar.weekdays.sun', 'Sun'),
    t('calendar.weekdays.mon', 'Mon'),
    t('calendar.weekdays.tue', 'Tue'),
    t('calendar.weekdays.wed', 'Wed'),
    t('calendar.weekdays.thu', 'Thu'),
    t('calendar.weekdays.fri', 'Fri'),
    t('calendar.weekdays.sat', 'Sat'),
  ];

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'manager_1on1':
        return 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20';
      case 'buddy_coffee':
        return 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20';
      case 'orientation':
        return 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'training':
        return 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20';
      default:
        return 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20';
    }
  };

  return (
    <div className="w-full select-none" data-testid="calendar-week-view">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3 p-4">
        {weekDays.map((day, idx) => {
          const dayEvents = getEventsForDay(day);
          const activeToday = isToday(day);

          return (
            <div
              key={idx}
              className={`flex flex-col rounded-xl border p-3 min-h-[380px] transition-all ${
                activeToday
                  ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-sm'
                  : 'border-border bg-card'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
                <div>
                  <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground block">
                    {weekdayNames[day.getDay()]}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-sm font-bold inline-flex items-center justify-center h-6 w-6 rounded-full ${
                        activeToday
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-foreground'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    {activeToday && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                        {t('calendar.nav.today', 'Today')}
                      </Badge>
                    )}
                  </div>
                </div>

                {isManager && (
                  <button
                    type="button"
                    onClick={() => onQuickSchedule(day)}
                    title={t('calendar.agendaDrawer.scheduleForDay', 'Schedule meeting on this day')}
                    className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-indigo-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Day Events Stack */}
              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[460px]">
                {dayEvents.length === 0 ? (
                  <div
                    onClick={() => onSelectDate(day)}
                    className="h-32 flex flex-col items-center justify-center border border-dashed rounded-lg p-2 text-center text-muted-foreground/60 hover:border-indigo-300 hover:text-muted-foreground cursor-pointer transition-colors"
                  >
                    <Clock className="h-5 w-5 mb-1 stroke-1" />
                    <span className="text-xs">
                      {t('calendar.roster.empty', 'No meetings')}
                    </span>
                  </div>
                ) : (
                  dayEvents.map((ev) => {
                    const startTimeStr = new Date(ev.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const endTimeStr = new Date(ev.endTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={ev._id}
                        data-testid={`week-event-card-${ev._id}`}
                        onClick={() => onSelectEvent(ev)}
                        className={`p-2.5 rounded-lg border text-xs shadow-xs hover:shadow-sm cursor-pointer transition-all ${getCategoryStyles(
                          ev.category
                        )} ${ev.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-semibold text-foreground truncate" title={`${ev.title} (${getCategoryLabel(ev.category)})`}>{ev.title}</span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {startTimeStr}
                          </span>
                        </div>

                        <div className="text-[11px] text-muted-foreground flex items-center justify-between mt-1">
                          <span>
                            {startTimeStr} - {endTimeStr}
                          </span>
                          <span className="flex items-center gap-0.5 text-[10px]">
                            <Users className="h-3 w-3" />
                            {ev.attendeeUserIds?.length || 1}
                          </span>
                        </div>

                        {ev.locationUrl && (
                          <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between">
                            <a
                              href={ev.locationUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                              <Video className="h-3 w-3" /> {t('calendar.roster.joinVideoCall', 'Join')}
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>

                            {onOpenNotes && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenNotes(ev);
                                }}
                                className="text-muted-foreground hover:text-foreground"
                                title={t('calendar.roster.addNotes', 'Notes')}
                              >
                                <FileText className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick Action */}
              <div className="pt-2 mt-2 border-t border-border/40 text-center">
                <button
                  type="button"
                  onClick={() => onSelectDate(day)}
                  className="text-[11px] text-muted-foreground hover:text-indigo-600 font-medium transition-colors"
                >
                  {t('calendar.agendaDrawer.title', { date: `${day.getDate()}` })} →
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWeekView;
