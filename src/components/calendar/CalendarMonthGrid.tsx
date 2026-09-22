import React from 'react';
import { useTranslation } from 'react-i18next';
import { MeetingEvent } from '../../services/calendar.service';
import { Clock } from 'lucide-react';

interface CalendarMonthGridProps {
  currentDate: Date;
  events: MeetingEvent[];
  onSelectDate: (date: Date) => void;
  onSelectEvent: (event: MeetingEvent) => void;
  getCategoryLabel: (category: string) => string;
}

export const CalendarMonthGrid: React.FC<CalendarMonthGridProps> = ({
  currentDate,
  events,
  onSelectDate,
  onSelectEvent,
  getCategoryLabel,
}) => {
  const { t } = useTranslation(['integrations', 'common']);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of current month
  const firstDay = new Date(year, month, 1);
  const startingDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon ...

  // Days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Days in previous month for padding
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const isCurrentDay = (d: number, m: number, y: number) => {
    return (
      today.getDate() === d &&
      today.getMonth() === m &&
      today.getFullYear() === y
    );
  };

  // Group events by date key 'YYYY-MM-DD'
  const eventsByDate = React.useMemo(() => {
    const map: Record<string, MeetingEvent[]> = {};
    for (const ev of events || []) {
      const d = new Date(ev.startTime);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(ev);
    }
    return map;
  }, [events]);

  const weekdays = [
    t('calendar.weekdays.sun', 'Sun'),
    t('calendar.weekdays.mon', 'Mon'),
    t('calendar.weekdays.tue', 'Tue'),
    t('calendar.weekdays.wed', 'Wed'),
    t('calendar.weekdays.thu', 'Thu'),
    t('calendar.weekdays.fri', 'Fri'),
    t('calendar.weekdays.sat', 'Sat'),
  ];

  // Build grid days (previous month trailing, current month, next month leading)
  const cells: Array<{
    dayNumber: number;
    monthOffset: number; // -1 = prev, 0 = curr, 1 = next
    date: Date;
    dateKey: string;
  }> = [];

  // Trailing previous month days
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    const prevDay = daysInPrevMonth - i;
    const date = new Date(year, month - 1, prevDay);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    cells.push({ dayNumber: prevDay, monthOffset: -1, date, dateKey });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    cells.push({ dayNumber: i, monthOffset: 0, date, dateKey });
  }

  // Leading next month days to complete weeks (multiples of 7)
  const remainingCells = 7 - (cells.length % 7);
  if (remainingCells < 7) {
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(year, month + 1, i);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      cells.push({ dayNumber: i, monthOffset: 1, date, dateKey });
    }
  }

  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'manager_1on1':
        return 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100';
      case 'buddy_coffee':
        return 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100';
      case 'orientation':
        return 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100';
      case 'training':
        return 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800 hover:bg-purple-100';
      default:
        return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100';
    }
  };

  return (
    <div className="w-full select-none" data-testid="calendar-month-grid">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/20 text-center py-2.5">
        {weekdays.map((day, idx) => (
          <div key={idx} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 divide-x divide-y border-b border-l border-r border-border">
        {cells.map((cell, idx) => {
          const isToday = isCurrentDay(cell.date.getDate(), cell.date.getMonth(), cell.date.getFullYear());
          const isCurrentMonth = cell.monthOffset === 0;
          const dayEvents = eventsByDate[cell.dateKey] || [];

          return (
            <div
              key={idx}
              data-testid={`calendar-day-cell-${cell.dateKey}`}
              onClick={() => onSelectDate(cell.date)}
              className={`min-h-[110px] p-2 transition-colors cursor-pointer relative group flex flex-col justify-between ${
                isCurrentMonth
                  ? 'bg-card hover:bg-muted/30'
                  : 'bg-muted/10 text-muted-foreground/60 hover:bg-muted/20'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-medium inline-flex items-center justify-center h-6 w-6 rounded-full transition-transform group-hover:scale-105 ${
                    isToday
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : isCurrentMonth
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {dayEvents.length > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Pills */}
              <div className="space-y-1 overflow-hidden flex-1">
                {dayEvents.slice(0, 3).map((ev) => {
                  const startTimeStr = new Date(ev.startTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <div
                      key={ev._id}
                      data-testid={`event-pill-${ev._id}`}
                      title={`${startTimeStr} - ${ev.title} (${getCategoryLabel(ev.category)})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEvent(ev);
                      }}
                      className={`text-[11px] truncate px-2 py-0.5 rounded border transition-all flex items-center gap-1 ${getCategoryStyles(
                        ev.category
                      )} ${ev.status === 'cancelled' ? 'line-through opacity-50' : ''}`}
                    >
                      <Clock className="h-2.5 w-2.5 shrink-0" />
                      <span className="font-semibold shrink-0">{startTimeStr}</span>
                      <span className="truncate">{ev.title}</span>
                    </div>
                  );
                })}

                {dayEvents.length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(cell.date);
                    }}
                    className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 pl-1 block transition-colors"
                  >
                    {t('calendar.agendaDrawer.moreEvents', {
                      count: dayEvents.length - 3,
                      defaultValue: `+${dayEvents.length - 3} more`,
                    })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarMonthGrid;
