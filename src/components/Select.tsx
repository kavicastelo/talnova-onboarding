import * as React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from './utils';

// --- Context ---
interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue>({
  value: '',
  onValueChange: () => undefined,
  open: false,
  setOpen: () => undefined,
});

// --- Select ---
export interface SelectProps {
  children: React.ReactNode;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const Select = ({ children, value: controlledValue, defaultValue, onValueChange, className }: SelectProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
  const [open, setOpen] = React.useState(false);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const handleChange = (v: string) => {
    if (controlledValue === undefined) setInternalValue(v);
    onValueChange?.(v);
    setOpen(false);
  };

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleChange, open, setOpen }}>
      <div data-slot="select" className={cn("relative inline-block", className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
};

// --- SelectTrigger ---
export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'default' | 'sm';
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, size = 'default', children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(SelectContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="select-trigger"
        data-size={size}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          size === 'default' ? 'h-8' : 'h-7 rounded-md',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="pointer-events-none size-4 text-muted-foreground" />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

// --- SelectValue ---
export interface SelectValueProps {
  placeholder?: string;
}

export const SelectValue = ({ placeholder }: SelectValueProps) => {
  const { value } = React.useContext(SelectContext);
  return (
    <span
      data-slot="select-value"
      data-placeholder={!value || undefined}
      className={cn(!value && 'text-muted-foreground')}
    >
      {value || placeholder}
    </span>
  );
};

// --- SelectContent ---
export const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(SelectContext);
    if (!open) return null;
    return (
      <div
        ref={ref}
        data-slot="select-content"
        className={cn(
          'absolute top-full left-0 z-50 mt-1 min-w-36 overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

// --- SelectItem ---
export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  disabled?: boolean;
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, disabled, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(SelectContext);
    const isSelected = selectedValue === value;

    return (
      <div
        ref={ref}
        data-slot="select-item"
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onValueChange?.(value)}
        className={cn(
          'relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground',
          className
        )}
        {...props}
      >
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
          {isSelected && <Check className="size-4" />}
        </span>
        <span>{children}</span>
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

// --- SelectGroup ---
export const SelectGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="select-group" className={cn('p-1', className)} {...props} />
  )
);
SelectGroup.displayName = 'SelectGroup';

// --- SelectLabel ---
export const SelectLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="select-label" className={cn('px-1.5 py-1 text-xs text-muted-foreground', className)} {...props} />
  )
);
SelectLabel.displayName = 'SelectLabel';
