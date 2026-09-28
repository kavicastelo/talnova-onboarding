import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  onValueChange: () => undefined,
  orientation: 'horizontal',
});

// --- Tabs ---
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
}

export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue = '', value: controlledValue, onValueChange, orientation = 'horizontal', children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const value = controlledValue !== undefined ? controlledValue : internalValue;

    const handleChange = (v: string) => {
      if (controlledValue === undefined) setInternalValue(v);
      onValueChange?.(v);
    };

    return (
      <TabsContext.Provider value={{ value, onValueChange: handleChange, orientation }}>
        <div
          ref={ref}
          data-slot="tabs"
          data-orientation={orientation}
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = 'Tabs';

// --- TabsList ---
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'underline' | 'sidebar';
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const { orientation } = React.useContext(TabsContext);
    const isSidebar = variant === 'sidebar' || orientation === 'vertical';

    return (
      <div
        ref={ref}
        data-slot="tabs-list"
        data-variant={variant}
        data-orientation={orientation}
        role="tablist"
        aria-orientation={orientation}
        className={cn(
          isSidebar
            ? 'flex flex-col w-full h-auto bg-transparent p-0 gap-1 items-stretch justify-start overflow-visible text-muted-foreground'
            : 'inline-flex h-8 w-fit max-w-full overflow-x-auto items-center justify-start rounded-lg p-[3px] text-muted-foreground scrollbar-none',
          variant === 'default' && !isSidebar && 'bg-muted',
          variant === 'underline' && 'gap-1 bg-transparent rounded-none',
          className
        )}
        {...props}
      />
    );
  }
);
TabsList.displayName = 'TabsList';

// --- TabsTrigger ---
export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const { value: selectedValue, onValueChange, orientation } = React.useContext(TabsContext);
    const isActive = selectedValue === value;
    const isVertical = orientation === 'vertical';

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        data-slot="tabs-trigger"
        data-active={isActive || undefined}
        aria-selected={isActive}
        onClick={() => onValueChange(value)}
        className={cn(
          isVertical
            ? "relative inline-flex h-9 w-full shrink-0 items-center justify-start gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-all hover:bg-muted/70 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 text-left"
            : "relative inline-flex h-[calc(100%-1px)] flex-1 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          isActive && (
            isVertical
              ? 'bg-primary/10 text-primary font-semibold shadow-xs dark:bg-primary/20 dark:text-indigo-400'
              : 'bg-background text-foreground shadow-sm dark:border-input dark:bg-input/30'
          ),
          className
        )}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

// --- TabsContent ---
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const { value: selectedValue } = React.useContext(TabsContext);
    if (selectedValue !== value) return null;

    return (
      <div
        ref={ref}
        data-slot="tabs-content"
        role="tabpanel"
        className={cn('flex-1 text-sm outline-none', className)}
        {...props}
      />
    );
  }
);
TabsContent.displayName = 'TabsContent';
