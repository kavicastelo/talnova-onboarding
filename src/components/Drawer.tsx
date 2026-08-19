import * as React from 'react';

import { cn } from './utils';

// --- Context ---
interface DrawerContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  direction: 'bottom' | 'top' | 'left' | 'right';
}

const DrawerContext = React.createContext<DrawerContextValue>({
  open: false,
  setOpen: () => undefined,
  direction: 'bottom',
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
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  };

  return (
    <DrawerContext.Provider value={{ open, setOpen, direction }}>
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
        onClick={(e) => { setOpen(true); onClick?.(e); }}
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
        onClick={(e) => { setOpen(false); onClick?.(e); }}
        {...props}
      />
    );
  }
);
DrawerClose.displayName = 'DrawerClose';

const drawerSideClasses = {
  bottom: 'inset-x-0 bottom-0 mt-24 max-h-[80vh] rounded-t-xl border-t',
  top: 'inset-x-0 top-0 mb-24 max-h-[80vh] rounded-b-xl border-b',
  left: 'inset-y-0 left-0 w-3/4 sm:max-w-sm rounded-r-xl border-r',
  right: 'inset-y-0 right-0 w-3/4 sm:max-w-sm rounded-l-xl border-l',
};

// --- DrawerContent ---
export const DrawerContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, direction, setOpen } = React.useContext(DrawerContext);
    if (!open) return null;

    return (
      <>
        <div
          className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
        <div
          ref={ref}
          data-slot="drawer-content"
          className={cn(
            'fixed z-50 flex h-auto flex-col bg-background text-sm',
            drawerSideClasses[direction],
            className
          )}
          {...props}
        >
          {direction === 'bottom' && (
            <div className="mx-auto mt-4 h-1 w-[100px] shrink-0 rounded-full bg-muted" />
          )}
          {children}
        </div>
      </>
    );
  }
);
DrawerContent.displayName = 'DrawerContent';

// --- DrawerHeader ---
export const DrawerHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="drawer-header" className={cn('flex flex-col gap-0.5 p-4', className)} {...props} />
  )
);
DrawerHeader.displayName = 'DrawerHeader';

// --- DrawerFooter ---
export const DrawerFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="drawer-footer" className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
  )
);
DrawerFooter.displayName = 'DrawerFooter';

// --- DrawerTitle ---
export const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} data-slot="drawer-title" className={cn('text-base font-medium text-foreground', className)} {...props} />
  )
);
DrawerTitle.displayName = 'DrawerTitle';

// --- DrawerDescription ---
export const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="drawer-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
);
DrawerDescription.displayName = 'DrawerDescription';
