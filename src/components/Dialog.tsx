import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from './utils';
import { Slot } from './Slot';

// --- Context ---
interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId?: string;
  setTitleId: (id: string) => void;
  descId?: string;
  setDescId: (id: string) => void;
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => undefined,
  titleId: undefined,
  setTitleId: () => undefined,
  descId: undefined,
  setDescId: () => undefined,
});

// --- Dialog ---
export interface DialogProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: DialogProps) => {
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
    <DialogContext.Provider value={{ open, setOpen, titleId, setTitleId, descId, setDescId }}>
      {children}
    </DialogContext.Provider>
  );
};

// --- DialogTrigger ---
export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ onClick, asChild, ...props }, ref) => {
    const { setOpen } = React.useContext(DialogContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        data-slot="dialog-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }
);
DialogTrigger.displayName = 'DialogTrigger';

// --- DialogContent ---
export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, showCloseButton = true, closeOnBackdrop = true, ...props }, forwardedRef) => {
    const { open, setOpen, titleId, descId } = React.useContext(DialogContext);
    const internalRef = React.useRef<HTMLDivElement | null>(null);

    // Merge refs
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

    // Prevent body scrolling when open
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

    // Focus trapping & initial focus
    React.useEffect(() => {
      if (!open || !internalRef.current) return;
      const focusable = internalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        // Focus first actionable element, or the modal itself
        focusable[0].focus();
      } else {
        internalRef.current.focus();
      }
    }, [open]);

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
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
          onClick={() => {
            if (closeOnBackdrop) setOpen(false);
          }}
          aria-hidden="true"
        />

        {/* Dialog Card / Mobile Sheet */}
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          data-slot="dialog-content"
          className={cn(
            // Positioning & Mobile Sheet Transform:
            'relative z-50 w-full bg-card text-card-foreground shadow-2xl border border-border/80 outline-none flex flex-col overflow-hidden',
            // Mobile: Bottom Sheet with rounded top, max-h 92vh, slide in from bottom
            'max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:max-h-[92vh] max-sm:border-b-0 max-sm:border-x-0 max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300',
            // Desktop: Floating modal, rounded-2xl, max-h 90vh, zoom & fade in
            'sm:rounded-2xl sm:max-h-[90vh] sm:max-w-lg sm:animate-in sm:zoom-in-95 sm:fade-in sm:duration-200',
            className
          )}
          {...props}
        >
          {/* Mobile Drag Indicator Bar */}
          <div className="mx-auto mt-2.5 -mb-1 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" />

          {children}

          {showCloseButton && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>
    );
  }
);
DialogContent.displayName = 'DialogContent';

// --- DialogHeader ---
export const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1.5 p-5 pb-3 pr-10 sm:pr-12 border-b border-border/60 bg-card/60 shrink-0', className)}
      {...props}
    />
  )
);
DialogHeader.displayName = 'DialogHeader';

// --- DialogBody ---
export interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  scrollable?: boolean;
}

export const DialogBody = React.forwardRef<HTMLDivElement, DialogBodyProps>(
  ({ className, scrollable = true, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="dialog-body"
      className={cn(
        'p-5 sm:p-6 text-sm',
        scrollable && 'flex-1 overflow-y-auto min-h-0 overscroll-contain',
        className
      )}
      {...props}
    />
  )
);
DialogBody.displayName = 'DialogBody';

// --- DialogFooter ---
export const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-4 sm:px-6 border-t border-border/60 bg-muted/30 shrink-0 mt-auto',
        className
      )}
      {...props}
    />
  )
);
DialogFooter.displayName = 'DialogFooter';

// --- DialogTitle ---
export const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setTitleId } = React.useContext(DialogContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setTitleId(id);
    }, [id, setTitleId]);

    return (
      <h2
        ref={ref}
        id={id}
        data-slot="dialog-title"
        className={cn('text-lg font-semibold leading-tight tracking-tight text-foreground', className)}
        {...props}
      />
    );
  }
);
DialogTitle.displayName = 'DialogTitle';

// --- DialogDescription ---
export const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setDescId } = React.useContext(DialogContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setDescId(id);
    }, [id, setDescId]);

    return (
      <p
        ref={ref}
        id={id}
        data-slot="dialog-description"
        className={cn('text-xs text-muted-foreground leading-relaxed', className)}
        {...props}
      />
    );
  }
);
DialogDescription.displayName = 'DialogDescription';
