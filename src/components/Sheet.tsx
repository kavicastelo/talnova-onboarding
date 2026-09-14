import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { Slot } from './Slot';

// --- Context ---
interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId?: string;
  setTitleId: (id: string) => void;
  descId?: string;
  setDescId: (id: string) => void;
}

const SheetContext = React.createContext<SheetContextValue>({
  open: false,
  setOpen: () => undefined,
  titleId: undefined,
  setTitleId: () => undefined,
  descId: undefined,
  setDescId: () => undefined,
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
  const [titleId, setTitleId] = React.useState<string | undefined>(undefined);
  const [descId, setDescId] = React.useState<string | undefined>(undefined);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [controlledOpen, onOpenChange]
  );

  return (
    <SheetContext.Provider value={{ open, setOpen, titleId, setTitleId, descId, setDescId }}>
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
        type={asChild ? undefined : 'button'}
        data-slot="sheet-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }
);
SheetTrigger.displayName = 'SheetTrigger';

const sheetSideClasses = {
  right: 'inset-y-0 right-0 h-full w-full sm:max-w-md border-l animate-in slide-in-from-right duration-300',
  left: 'inset-y-0 left-0 h-full w-full sm:max-w-md border-r animate-in slide-in-from-left duration-300',
  top: 'inset-x-0 top-0 h-auto max-h-[85vh] border-b animate-in slide-in-from-top duration-300',
  bottom: 'inset-x-0 bottom-0 h-auto max-h-[85vh] rounded-t-2xl border-t animate-in slide-in-from-bottom duration-300',
};

// --- SheetContent ---
export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'right' | 'left' | 'top' | 'bottom';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ className, children, side = 'right', showCloseButton = true, closeOnBackdrop = true, ...props }, forwardedRef) => {
    const { open, setOpen, titleId, descId } = React.useContext(SheetContext);
    const internalRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        internalRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    // Scroll locking
    React.useEffect(() => {
      if (!open) return;
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }, [open]);

    // Handle Escape key
    React.useEffect(() => {
      if (!open) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, setOpen]);

    // Focus trapping
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== 'Tab' || !internalRef.current) return;
      const focusableElements = internalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusableElements.length === 0) return;
      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
          onClick={() => {
            if (closeOnBackdrop) setOpen(false);
          }}
          aria-hidden="true"
        />
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            'fixed z-50 flex flex-col bg-card text-card-foreground shadow-2xl border-border outline-none overflow-y-auto',
            sheetSideClasses[side],
            className
          )}
          {...props}
        >
          {side === 'bottom' && (
            <div className="mx-auto mt-2.5 -mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
          )}
          {children}
          {showCloseButton && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3.5 right-3.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
SheetContent.displayName = 'SheetContent';

// --- SheetHeader ---
export const SheetHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-header"
      className={cn('flex flex-col gap-1.5 p-5 pb-4 border-b border-border/60 bg-card/60 shrink-0', className)}
      {...props}
    />
  )
);
SheetHeader.displayName = 'SheetHeader';

// --- SheetFooter ---
export const SheetFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sheet-footer"
      className={cn('mt-auto flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-4 sm:px-6 border-t border-border/60 bg-muted/30 shrink-0', className)}
      {...props}
    />
  )
);
SheetFooter.displayName = 'SheetFooter';

// --- SheetTitle ---
export const SheetTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setTitleId } = React.useContext(SheetContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setTitleId(id);
    }, [id, setTitleId]);

    return (
      <h2
        ref={ref}
        id={id}
        data-slot="sheet-title"
        className={cn('text-lg font-semibold leading-tight text-foreground', className)}
        {...props}
      />
    );
  }
);
SheetTitle.displayName = 'SheetTitle';

// --- SheetDescription ---
export const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setDescId } = React.useContext(SheetContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setDescId(id);
    }, [id, setDescId]);

    return (
      <p
        ref={ref}
        id={id}
        data-slot="sheet-description"
        className={cn('text-xs text-muted-foreground leading-relaxed', className)}
        {...props}
      />
    );
  }
);
SheetDescription.displayName = 'SheetDescription';
