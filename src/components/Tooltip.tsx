import * as React from 'react';
import { cn } from './utils';

import { Slot } from './Slot';

// --- Context ---
interface TooltipContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
});

// --- TooltipProvider (no-op wrapper for API compat) ---
export const TooltipProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;

// --- Tooltip ---
export interface TooltipProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Tooltip = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: TooltipProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </TooltipContext.Provider>
  );
};

// --- TooltipTrigger ---
export interface TooltipTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ onMouseEnter, onMouseLeave, asChild, ...props }, ref) => {
    const { setOpen } = React.useContext(TooltipContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        data-slot="tooltip-trigger"
        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(true); onMouseEnter?.(e); }}
        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(false); onMouseLeave?.(e); }}
        {...props}
      />
    );
  }
);
TooltipTrigger.displayName = 'TooltipTrigger';

// --- TooltipContent ---
export const TooltipContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open } = React.useContext(TooltipContext);
    if (!open) return null;
    return (
      <div
        ref={ref}
        data-slot="tooltip-content"
        className={cn(
          'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 inline-flex w-fit max-w-xs items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs text-background',
          className
        )}
        {...props}
      />
    );
  }
);
TooltipContent.displayName = 'TooltipContent';
