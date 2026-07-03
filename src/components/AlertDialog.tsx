import * as React from 'react';
import { cn } from './utils';

import { Slot } from './Slot';

// --- Context ---
interface AlertDialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  setOpen: () => {},
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
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <AlertDialogContext.Provider value={{ open, setOpen }}>
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
        type={asChild ? undefined : "button"}
        data-slot="alert-dialog-trigger"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => { setOpen(true); onClick?.(e); }}
        {...props}
      />
    );
  }
);
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

// --- AlertDialogContent ---
export interface AlertDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const AlertDialogContent = React.forwardRef<HTMLDivElement, AlertDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open } = React.useContext(AlertDialogContext);
    if (!open) return null;

    return (
      <>
        <div className="fixed inset-0 z-50 bg-black/50" />
        <div
          ref={ref}
          data-slot="alert-dialog-content"
          role="alertdialog"
          aria-modal="true"
          className={cn(
            'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-background p-4 text-sm ring-1 ring-foreground/10 sm:max-w-sm',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </>
    );
  }
);
AlertDialogContent.displayName = 'AlertDialogContent';

// --- AlertDialogHeader ---
export const AlertDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} data-slot="alert-dialog-header" className={cn('flex flex-col gap-2', className)} {...props} />
));
AlertDialogHeader.displayName = 'AlertDialogHeader';

// --- AlertDialogFooter ---
export const AlertDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="alert-dialog-footer"
    className={cn(
      '-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end',
      className
    )}
    {...props}
  />
));
AlertDialogFooter.displayName = 'AlertDialogFooter';

// --- AlertDialogTitle ---
export const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2 ref={ref} data-slot="alert-dialog-title" className={cn('text-base leading-none font-medium', className)} {...props} />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

// --- AlertDialogDescription ---
export const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} data-slot="alert-dialog-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

// --- AlertDialogAction ---
export const AlertDialogAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      type="button"
      data-slot="alert-dialog-action"
      onClick={(e) => { setOpen(false); onClick?.(e); }}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80',
        className
      )}
      {...props}
    />
  );
});
AlertDialogAction.displayName = 'AlertDialogAction';

// --- AlertDialogCancel ---
export const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(AlertDialogContext);
  return (
    <button
      ref={ref}
      type="button"
      data-slot="alert-dialog-cancel"
      onClick={(e) => { setOpen(false); onClick?.(e); }}
      className={cn(
        'inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted',
        className
      )}
      {...props}
    />
  );
});
AlertDialogCancel.displayName = 'AlertDialogCancel';
