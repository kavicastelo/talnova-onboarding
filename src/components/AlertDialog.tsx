import * as React from 'react';
import { cn } from './utils';
import { Slot } from './Slot';

// --- Context ---
interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId?: string;
  setTitleId: (id: string) => void;
  descId?: string;
  setDescId: (id: string) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  setOpen: () => undefined,
  titleId: undefined,
  setTitleId: () => undefined,
  descId: undefined,
  setDescId: () => undefined,
});

// --- AlertDialog ---
export interface AlertDialogProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AlertDialog = ({ children, open: controlledOpen, defaultOpen = false, onOpenChange }: AlertDialogProps) => {
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
    <AlertDialogContext.Provider value={{ open, setOpen, titleId, setTitleId, descId, setDescId }}>
      {children}
    </AlertDialogContext.Provider>
  );
};

// --- AlertDialogTrigger ---
export interface AlertDialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const AlertDialogTrigger = React.forwardRef<HTMLButtonElement, AlertDialogTriggerProps>(
  ({ onClick, asChild, ...props }, ref) => {
    const { setOpen } = React.useContext(AlertDialogContext);
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        data-slot="alert-dialog-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }
);
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

// --- AlertDialogContent ---
export type AlertDialogContentProps = React.HTMLAttributes<HTMLDivElement>;

export const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, forwardedRef) => {
    const { open, setOpen, titleId, descId } = React.useContext(AlertDialogContext);
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
    React.useEffect(() => {
      if (!open || !internalRef.current) return;
      const focusable = internalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          ref={setRefs}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          data-slot="alert-dialog-content"
          className={cn(
            'relative z-50 w-full bg-card text-card-foreground shadow-2xl border border-border/80 outline-none flex flex-col p-6',
            'max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:max-h-[92vh] max-sm:border-b-0 max-sm:border-x-0 max-sm:animate-in max-sm:slide-in-from-bottom max-sm:duration-300',
            'sm:rounded-2xl sm:max-w-md sm:animate-in sm:zoom-in-95 sm:fade-in sm:duration-200',
            className
          )}
          {...props}
        >
          <div className="mx-auto -mt-3 mb-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30 sm:hidden" />
          {children}
        </div>
      </div>
    );
  }
);
AlertDialogContent.displayName = 'AlertDialogContent';

// --- AlertDialogHeader ---
export const AlertDialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="alert-dialog-header" className={cn('flex flex-col gap-2 text-center sm:text-left', className)} {...props} />
  )
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

// --- AlertDialogFooter ---
export const AlertDialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="alert-dialog-footer"
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

// --- AlertDialogTitle ---
export const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setTitleId } = React.useContext(AlertDialogContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setTitleId(id);
    }, [id, setTitleId]);

    return (
      <h2
        ref={ref}
        id={id}
        data-slot="alert-dialog-title"
        className={cn('text-lg font-semibold leading-tight text-foreground', className)}
        {...props}
      />
    );
  }
);
AlertDialogTitle.displayName = 'AlertDialogTitle';

// --- AlertDialogDescription ---
export const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setDescId } = React.useContext(AlertDialogContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setDescId(id);
    }, [id, setDescId]);

    return (
      <p
        ref={ref}
        id={id}
        data-slot="alert-dialog-description"
        className={cn('text-xs text-muted-foreground leading-relaxed', className)}
        {...props}
      />
    );
  }
);
AlertDialogDescription.displayName = 'AlertDialogDescription';

// --- AlertDialogAction ---
export const AlertDialogAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(AlertDialogContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="alert-dialog-action"
        onClick={(e) => {
          setOpen(false);
          onClick?.(e);
        }}
        className={cn(
          'inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      />
    );
  }
);
AlertDialogAction.displayName = 'AlertDialogAction';

// --- AlertDialogCancel ---
export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(AlertDialogContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="alert-dialog-cancel"
        onClick={(e) => {
          setOpen(false);
          onClick?.(e);
        }}
        className={cn(
          'inline-flex h-9 items-center justify-center rounded-xl border border-border bg-background px-4 text-xs font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      />
    );
  }
);
AlertDialogCancel.displayName = 'AlertDialogCancel';
