import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface ContextMenuContextValue {
  open: boolean;
  position: { x: number; y: number };
  setOpen: (open: boolean) => void;
  setPosition: (pos: { x: number; y: number }) => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue>({
  open: false,
  position: { x: 0, y: 0 },
  setOpen: () => undefined,
  setPosition: () => undefined,
});

// --- ContextMenu ---
export const ContextMenu = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  return (
    <ContextMenuContext.Provider value={{ open, position, setOpen, setPosition }}>
      {children}
    </ContextMenuContext.Provider>
  );
};

// --- ContextMenuTrigger ---
export const ContextMenuTrigger = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { setOpen, setPosition } = React.useContext(ContextMenuContext);
    return (
      <div
        ref={ref}
        data-slot="context-menu-trigger"
        onContextMenu={(e) => {
          e.preventDefault();
          setPosition({ x: e.clientX, y: e.clientY });
          setOpen(true);
        }}
        className={cn('select-none', className)}
        {...props}
      />
    );
  }
);
ContextMenuTrigger.displayName = 'ContextMenuTrigger';

// --- ContextMenuContent ---
export const ContextMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, position, setOpen } = React.useContext(ContextMenuContext);

    React.useEffect(() => {
      if (!open) return;
      const handler = () => setOpen(false);
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }, [open, setOpen]);

    if (!open) return null;

    return (
      <div
        ref={ref}
        data-slot="context-menu-content"
        style={{ position: 'fixed', top: position.y, left: position.x }}
        className={cn(
          'z-50 min-w-36 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
          className
        )}
        {...props}
      />
    );
  }
);
ContextMenuContent.displayName = 'ContextMenuContent';

// --- ContextMenuItem ---
export interface ContextMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}

export const ContextMenuItem = React.forwardRef<HTMLDivElement, ContextMenuItemProps>(
  ({ className, inset, variant = 'default', ...props }, ref) => {
    const { setOpen } = React.useContext(ContextMenuContext);
    return (
      <div
        ref={ref}
        data-slot="context-menu-item"
        data-variant={variant}
        onClick={() => setOpen(false)}
        className={cn(
          "relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          inset && 'pl-7',
          variant === 'destructive' && 'text-destructive hover:bg-destructive/10',
          className
        )}
        {...props}
      />
    );
  }
);
ContextMenuItem.displayName = 'ContextMenuItem';

// --- ContextMenuSeparator ---
export const ContextMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="context-menu-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
);
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

// --- ContextMenuShortcut ---
export const ContextMenuShortcut = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} data-slot="context-menu-shortcut" className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
  )
);
ContextMenuShortcut.displayName = 'ContextMenuShortcut';
