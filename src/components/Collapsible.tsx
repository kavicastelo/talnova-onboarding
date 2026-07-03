import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface CollapsibleContextValue {
  open: boolean;
  toggle: () => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({
  open: false,
  toggle: () => {},
});

// --- Collapsible ---
export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  ({ className, open: controlledOpen, defaultOpen = false, onOpenChange, children, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

    const toggle = () => {
      const next = !open;
      if (controlledOpen === undefined) setInternalOpen(next);
      onOpenChange?.(next);
    };

    return (
      <CollapsibleContext.Provider value={{ open, toggle }}>
        <div
          ref={ref}
          data-slot="collapsible"
          data-open={open || undefined}
          className={cn(className)}
          {...props}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  }
);
Collapsible.displayName = 'Collapsible';

// --- CollapsibleTrigger ---
export const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => {
  const { toggle } = React.useContext(CollapsibleContext);
  return (
    <button
      ref={ref}
      type="button"
      data-slot="collapsible-trigger"
      onClick={toggle}
      className={cn(className)}
      {...props}
    />
  );
});
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

// --- CollapsibleContent ---
export const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { open } = React.useContext(CollapsibleContext);
  if (!open) return null;
  return (
    <div ref={ref} data-slot="collapsible-content" className={cn(className)} {...props} />
  );
});
CollapsibleContent.displayName = 'CollapsibleContent';
