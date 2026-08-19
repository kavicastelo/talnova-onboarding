import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';

import { Slot } from './Slot';

// --- Context ---
interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  setOpen: () => undefined,
});

// --- Sheet ---
export interface SheetProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Sheet = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: SheetProps) => {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
};

// --- SheetTrigger ---
export interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ onClick, asChild, ...props }, ref) => {
    const { setOpen } = React.useContext(SheetContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : "button"}
        data-slot="sheet-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(true); onClick?.(e); }}
        {...props}
      />
    );
  }
);
SheetTrigger.displayName = 'SheetTrigger';

const sheetSideClasses = {
  right: 'inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
  left:  'inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
  top:   'inset-x-0 top-0 h-auto border-b',
  bottom:'inset-x-0 bottom-0 h-auto border-t',
};

// --- SheetContent ---
export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'right' | 'left' | 'top' | 'bottom';
  showCloseButton?: boolean;
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = 'right', showCloseButton = true, ...props }, ref) => {
    const { open, setOpen } = React.useContext(SheetContext);
    if (!open) return null;

    return (
      <>
        <div
          className="fixed inset-0 z-50 bg-black/10 supports-[backdrop-filter]:backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
        <div
          ref={ref}
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'fixed z-50 flex flex-col gap-4 bg-background text-sm shadow-lg',
            sheetSideClasses[side],
            className
          )}
          {...props}
        >
          {children}
          {showCloseButton && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 inline-flex size-7 items-center justify-center rounded-md hover:bg-muted"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
        </div>
      </>
    );
  }
);
SheetContent.displayName = 'SheetContent';

// --- SheetHeader ---
export const SheetHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sheet-header" className={cn('flex flex-col gap-0.5 p-4', className)} {...props} />
  )
);
SheetHeader.displayName = 'SheetHeader';

// --- SheetFooter ---
export const SheetFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
  )
);
SheetFooter.displayName = 'SheetFooter';

// --- SheetTitle ---
export const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} data-slot="sheet-title" className={cn('text-base font-medium text-foreground', className)} {...props} />
  )
);
SheetTitle.displayName = 'SheetTitle';

// --- SheetDescription ---
export const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="sheet-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
SheetDescription.displayName = 'SheetDescription';
