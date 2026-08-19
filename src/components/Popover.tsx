import * as React from 'react';
import { cn } from './utils';

import { Slot } from './Slot';

// --- Context ---
interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const PopoverContext = React.createContext<PopoverContextValue>({
  open: false,
  setOpen: () => undefined,
});

// --- Popover ---
export interface PopoverProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Popover = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: PopoverProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </PopoverContext.Provider>
  );
};

// --- PopoverTrigger ---
export interface PopoverTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ onClick, asChild, ...props }, ref) => {
    const { open, setOpen } = React.useContext(PopoverContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        data-slot="popover-trigger"
        aria-expanded={open}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(!open); onClick?.(e); }}
        {...props}
      />
    );
  }
);
PopoverTrigger.displayName = 'PopoverTrigger';

// --- PopoverContent ---
export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open } = React.useContext(PopoverContext);
    if (!open) return null;
    return (
      <div
        ref={ref}
        data-slot="popover-content"
        className={cn(
          'absolute top-full left-0 z-50 mt-1 flex w-72 flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10',
          className
        )}
        {...props}
      />
    );
  }
);
PopoverContent.displayName = 'PopoverContent';

// --- PopoverHeader ---
export const PopoverHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="popover-header" className={cn('flex flex-col gap-0.5 text-sm', className)} {...props} />
  )
);
PopoverHeader.displayName = 'PopoverHeader';

// --- PopoverTitle ---
export const PopoverTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="popover-title" className={cn('font-medium', className)} {...props} />
  )
);
PopoverTitle.displayName = 'PopoverTitle';

// --- PopoverDescription ---
export const PopoverDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="popover-description" className={cn('text-muted-foreground', className)} {...props} />
  )
);
PopoverDescription.displayName = 'PopoverDescription';
