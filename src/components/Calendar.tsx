import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './utils';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  selected?: Date;
  onSelect?: (date: Date) => void;
  month?: Date;
  onMonthChange?: (date: Date) => void;
}

export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  ({ className, selected, onSelect, month: controlledMonth, onMonthChange, ...props }, ref) => {
    const today = new Date();
    const [internalMonth, setInternalMonth] = React.useState(controlledMonth ?? today);
    const month = controlledMonth ?? internalMonth;
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = getDaysInMonth(year, monthIndex);
    const firstDay = getFirstDayOfMonth(year, monthIndex);

    const changeMonth = (delta: number) => {
      const next = new Date(year, monthIndex + delta, 1);
      if (controlledMonth === undefined) setInternalMonth(next);
      onMonthChange?.(next);
    };

    const isToday = (day: number) =>
      today.getDate() === day && today.getMonth() === monthIndex && today.getFullYear() === year;

    const isSelected = (day: number) =>
      selected &&
      selected.getDate() === day &&
      selected.getMonth() === monthIndex &&
      selected.getFullYear() === year;

    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let i = 1; i <= daysInMonth; i++) cells.push(i);

    return (
      <div
        ref={ref}
        data-slot="calendar"
        className={cn('bg-background p-2 w-fit', className)}
        {...props}
      >
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm font-medium select-none">
            {MONTHS[monthIndex]} {year}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="flex size-7 items-center justify-center text-[0.8rem] text-muted-foreground select-none"
            >
              {d}
            </div>
          ))}
          {cells.map((day, idx) => (
            <div key={idx} className="flex size-7 items-center justify-center">
              {day && (
                <button
                  type="button"
                  onClick={() => onSelect?.(new Date(year, monthIndex, day))}
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted',
                    isToday(day) && 'bg-muted font-medium',
                    isSelected(day) && 'bg-primary text-primary-foreground hover:bg-primary/80'
                  )}
                >
                  {day}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
Calendar.displayName = 'Calendar';
