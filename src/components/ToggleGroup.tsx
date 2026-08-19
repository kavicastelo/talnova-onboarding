import * as React from 'react';
import { cn } from './utils';

// --- Toggle button variants helper ---
type ToggleVariant = 'default' | 'outline';
type ToggleSize = 'default' | 'sm' | 'lg';

function toggleClass(variant: ToggleVariant = 'default', size: ToggleSize = 'default', pressed?: boolean, extra?: string) {
  const variantClass = variant === 'outline' ? 'border border-input bg-transparent hover:bg-muted' : 'bg-transparent';
  const sizeClass = size === 'sm'
    ? 'h-7 min-w-7 rounded-md px-1.5 text-[0.8rem]'
    : size === 'lg'
      ? 'h-9 min-w-9 px-2.5'
      : 'h-8 min-w-8 px-2';

  return cn(
    "inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-all outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted data-[state=on]:bg-muted [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    variantClass,
    sizeClass,
    pressed && 'bg-muted',
    extra
  );
}

// --- ToggleGroup Context ---
interface ToggleGroupContextValue {
  value: string[];
  onValueChange: (value: string) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  value: [],
  onValueChange: () => undefined,
});

// --- ToggleGroup ---
export interface ToggleGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple';
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
}

export const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      className,
      type = 'single',
      value: controlledValue,
      defaultValue,
      onValueChange,
      variant,
      size,
      children,
      ...props
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = React.useState<string[]>(
      defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : []
    );

    const value = controlledValue !== undefined
      ? Array.isArray(controlledValue) ? controlledValue : [controlledValue]
      : internalValue;

    const handleChange = (item: string) => {
      let next: string[];
      if (type === 'single') {
        next = value.includes(item) ? [] : [item];
      } else {
        next = value.includes(item) ? value.filter((v) => v !== item) : [...value, item];
      }
      if (controlledValue === undefined) setInternalValue(next);
      onValueChange?.(type === 'single' ? (next[0] ?? '') : next);
    };

    return (
      <ToggleGroupContext.Provider value={{ value, onValueChange: handleChange, variant, size }}>
        <div
          ref={ref}
          data-slot="toggle-group"
          role="group"
          className={cn('flex w-fit flex-row items-center gap-0 rounded-lg', className)}
          {...props}
        >
          {children}
        </div>
      </ToggleGroupContext.Provider>
    );
  }
);
ToggleGroup.displayName = 'ToggleGroup';

// --- ToggleGroupItem ---
export interface ToggleGroupItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(ToggleGroupContext);
    const isPressed = ctx.value.includes(value);

    return (
      <button
        ref={ref}
        type="button"
        data-slot="toggle-group-item"
        aria-pressed={isPressed}
        data-state={isPressed ? 'on' : 'off'}
        onClick={() => ctx.onValueChange(value)}
        className={toggleClass(
          ctx.variant,
          ctx.size,
          isPressed,
          cn('shrink-0 rounded-none first:rounded-l-lg last:rounded-r-lg', className)
        )}
        {...props}
      />
    );
  }
);
ToggleGroupItem.displayName = 'ToggleGroupItem';
