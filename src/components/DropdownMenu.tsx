import * as React from 'react';
import { cn } from './utils';

import { Slot } from './Slot';

// --- Context ---
interface DropdownMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue>({
  open: false,
  setOpen: () => {},
});

// --- DropdownMenu ---
export interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const DropdownMenu = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: DropdownMenuProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

// --- DropdownMenuTrigger ---
export interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLButtonElement, DropdownMenuTriggerProps>(
  ({ onClick, asChild, ...props }, ref) => {
    const { open, setOpen } = React.useContext(DropdownMenuContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        data-slot="dropdown-menu-trigger"
        aria-expanded={open}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(!open); onClick?.(e); }}
        {...props}
      />
    );
  }
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

// --- DropdownMenuContent ---
export interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom';
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = 'start', side = 'bottom', ...props }, ref) => {
    const { open } = React.useContext(DropdownMenuContext);
    if (!open) return null;
    return (
      <div
        ref={ref}
        data-slot="dropdown-menu-content"
        className={cn(
          'absolute z-50 min-w-32 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
          side === 'top' ? 'bottom-full mb-1' : 'top-full mt-1',
          align === 'end' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0',
          className
        )}
        {...props}
      />
    );
  }
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

// --- DropdownMenuItem ---
export interface DropdownMenuItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  onSelect?: (event: Event) => void;
}

export const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, inset, variant = 'default', onSelect, onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DropdownMenuContext);
    return (
      <div
        ref={ref}
        role="menuitem"
        data-slot="dropdown-menu-item"
        data-variant={variant}
        onClick={(e) => {
          onClick?.(e);
          onSelect?.(new Event('select'));
          setOpen(false);
        }}
        className={cn(
          "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          inset && 'pl-7',
          variant === 'destructive' && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
          className
        )}
        {...props}
      />
    );
  }
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

// --- DropdownMenuLabel ---
export interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

export const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="dropdown-menu-label"
      className={cn('px-1.5 py-1 text-xs font-medium text-muted-foreground', inset && 'pl-7', className)}
      {...props}
    />
  )
);
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

// --- DropdownMenuSeparator ---
export const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="dropdown-menu-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
);
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

// --- DropdownMenuShortcut ---
export const DropdownMenuShortcut = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} data-slot="dropdown-menu-shortcut" className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
  )
);
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';
