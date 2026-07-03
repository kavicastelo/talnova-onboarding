import * as React from 'react';
import {
  ResponsiveContainer,
} from 'recharts';
import { cn } from './utils';

// --- ChartConfig ---
export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
    icon?: React.ComponentType;
  }
>;

// --- ChartContext ---
interface ChartContextValue {
  config: ChartConfig;
}

const ChartContext = React.createContext<ChartContextValue>({ config: {} });

export function useChart() {
  return React.useContext(ChartContext);
}

// --- CSS variable injection helper ---
function injectChartCssVars(containerId: string, config: ChartConfig) {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(containerId + '-styles');
  if (existing) existing.remove();

  const vars = Object.entries(config)
    .filter(([, v]) => v.color)
    .map(([k, v]) => `--color-${k}: ${v.color};`)
    .join(' ');

  if (!vars) return;
  const style = document.createElement('style');
  style.id = containerId + '-styles';
  style.textContent = `#${containerId} { ${vars} }`;
  document.head.appendChild(style);
}

// --- ChartContainer (also exported as Chart) ---
export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config?: ChartConfig;
}

export const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ className, config = {}, children, ...props }, ref) => {
    const id = React.useId().replace(/:/g, '');

    React.useEffect(() => {
      injectChartCssVars(id, config);
    }, [id, config]);

    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          id={id}
          data-slot="chart"
          className={cn('flex aspect-video justify-center', className)}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

// Alias
export const Chart = ChartContainer;

// --- ChartTooltipContent ---
export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: Array<{ name?: string; value?: unknown; color?: string; dataKey?: string }>;
  label?: string;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'dot' | 'line' | 'dashed';
  nameKey?: string;
  labelKey?: string;
  className?: string;
  formatter?: (value: unknown, name: string) => React.ReactNode;
  labelFormatter?: (label: string, payload: unknown[]) => React.ReactNode;
}

export const ChartTooltipContent = React.forwardRef<HTMLDivElement, ChartTooltipContentProps>(
  ({ active, payload, label, hideLabel, className }, ref) => {
    if (!active || !payload?.length) return null;

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {!hideLabel && <div className="font-medium">{label}</div>}
        <div className="grid gap-1.5">
          {payload.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span
                className="block size-2 shrink-0 rounded-[2px]"
                style={{ background: entry.color }}
              />
              <span className="text-muted-foreground">{entry.name}</span>
              <span className="ml-auto font-mono font-medium">
                {typeof entry.value === 'number' ? entry.value.toLocaleString() : String(entry.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

// --- ChartLegendContent ---
export interface ChartLegendContentProps {
  payload?: Array<{ value?: string; color?: string }>;
  className?: string;
}

export const ChartLegendContent = React.forwardRef<HTMLDivElement, ChartLegendContentProps>(
  ({ payload, className }, ref) => {
    if (!payload?.length) return null;

    return (
      <div ref={ref} className={cn('flex flex-wrap items-center justify-center gap-4 pt-3 text-xs', className)}>
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className="block size-2 shrink-0 rounded-[2px]"
              style={{ background: entry.color }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
);
ChartLegendContent.displayName = 'ChartLegendContent';
