import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface HoverCardContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const HoverCardContext = React.createContext<HoverCardContextValue>({
  open: false,
  setOpen: () => {},
});

// --- HoverCard ---
export interface HoverCardProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const HoverCard = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: HoverCardProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <HoverCardContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </HoverCardContext.Provider>
  );
};

// --- HoverCardTrigger ---
export const HoverCardTrigger = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ onMouseEnter, onMouseLeave, ...props }, ref) => {
    const { setOpen } = React.useContext(HoverCardContext);
    return (
      <a
        ref={ref}
        data-slot="hover-card-trigger"
        onMouseEnter={(e) => { setOpen(true); onMouseEnter?.(e); }}
        onMouseLeave={(e) => { setOpen(false); onMouseLeave?.(e); }}
        {...props}
      />
    );
  }
);
HoverCardTrigger.displayName = 'HoverCardTrigger';

// --- HoverCardContent ---
export const HoverCardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open } = React.useContext(HoverCardContext);
    if (!open) return null;
    return (
      <div
        ref={ref}
        data-slot="hover-card-content"
        className={cn(
          'absolute top-full left-0 z-50 mt-2 w-64 rounded-lg bg-popover p-4 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none',
          className
        )}
        {...props}
      />
    );
  }
);
HoverCardContent.displayName = 'HoverCardContent';
