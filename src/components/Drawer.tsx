import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  direction: 'bottom' | 'top' | 'left' | 'right';
  titleId?: string;
  setTitleId: (id: string) => void;
  descId?: string;
  setDescId: (id: string) => void;
}

const DrawerContext = React.createContext<DrawerContextValue>({
  open: false,
  setOpen: () => undefined,
  direction: 'bottom',
  titleId: undefined,
  setTitleId: () => undefined,
  descId: undefined,
  setDescId: () => undefined,
});

// --- Drawer ---
export interface DrawerProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  direction?: 'bottom' | 'top' | 'left' | 'right';
}

export const Drawer = ({ children, open: controlledOpen, onOpenChange, direction = 'bottom' }: DrawerProps) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
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
    <DrawerContext.Provider value={{ open, setOpen, direction, titleId, setTitleId, descId, setDescId }}>
      {children}
    </DrawerContext.Provider>
  );
};

// --- DrawerTrigger ---
export const DrawerTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DrawerContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="drawer-trigger"
        onClick={(e) => {
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }
);
DrawerTrigger.displayName = 'DrawerTrigger';

// --- DrawerClose ---
export const DrawerClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DrawerContext);
    return (
      <button
        ref={ref}
        type="button"
        data-slot="drawer-close"
        onClick={(e) => {
          setOpen(false);
          onClick?.(e);
        }}
        {...props}
      />
    );
  }
);
DrawerClose.displayName = 'DrawerClose';

const drawerSideClasses = {
  bottom: 'inset-x-0 bottom-0 max-h-[88vh] rounded-t-2xl border-t animate-in slide-in-from-bottom duration-300',
  top: 'inset-x-0 top-0 max-h-[88vh] rounded-b-2xl border-b animate-in slide-in-from-top duration-300',
  left: 'inset-y-0 left-0 w-full sm:max-w-md border-r animate-in slide-in-from-left duration-300',
  right: 'inset-y-0 right-0 w-full sm:max-w-md border-l animate-in slide-in-from-right duration-300',
};

// --- DrawerContent ---
export const DrawerContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, forwardedRef) => {
    const { open, direction, setOpen, titleId, descId } = React.useContext(DrawerContext);
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

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-hidden">
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-in fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          ref={setRefs}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          tabIndex={-1}
          data-slot="drawer-content"
          className={cn(
            'fixed z-50 flex h-auto flex-col bg-card text-card-foreground shadow-2xl border-border outline-none overflow-y-auto',
            drawerSideClasses[direction],
            className
          )}
          {...props}
        >
          {direction === 'bottom' && (
            <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted-foreground/30" />
          )}
          {children}
        </div>
      </div>
    );
  }
);
DrawerContent.displayName = 'DrawerContent';

// --- DrawerHeader ---
export const DrawerHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="drawer-header" className={cn('flex flex-col gap-1 p-5 pb-3 border-b border-border/60 bg-card/60 shrink-0', className)} {...props} />
  )
);
DrawerHeader.displayName = 'DrawerHeader';

// --- DrawerFooter ---
export const DrawerFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="drawer-footer" className={cn('mt-auto flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 p-4 sm:px-6 border-t border-border/60 bg-muted/30 shrink-0', className)} {...props} />
  )
);
DrawerFooter.displayName = 'DrawerFooter';

// --- DrawerTitle ---
export const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setTitleId } = React.useContext(DrawerContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setTitleId(id);
    }, [id, setTitleId]);

    return (
      <h3 ref={ref} id={id} data-slot="drawer-title" className={cn('text-lg font-semibold leading-tight text-foreground', className)} {...props} />
    );
  }
);
DrawerTitle.displayName = 'DrawerTitle';

// --- DrawerDescription ---
export const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, id: propId, ...props }, ref) => {
    const { setDescId } = React.useContext(DrawerContext);
    const generatedId = React.useId();
    const id = propId || generatedId;

    React.useEffect(() => {
      setDescId(id);
    }, [id, setDescId]);

    return (
      <p ref={ref} id={id} data-slot="drawer-description" className={cn('text-xs text-muted-foreground leading-relaxed', className)} {...props} />
    );
  }
);
DrawerDescription.displayName = 'DrawerDescription';
