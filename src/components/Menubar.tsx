import * as React from 'react';
import { cn } from './utils';

// --- Context ---
interface MenubarContextValue {
  openMenu: string | null;
  setOpenMenu: (menu: string | null) => void;
}

const MenubarContext = React.createContext<MenubarContextValue>({
  openMenu: null,
  setOpenMenu: () => {},
});

const MenubarMenuContext = React.createContext<string>('');

// --- Menubar ---
export const Menubar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const [openMenu, setOpenMenu] = React.useState<string | null>(null);

    return (
      <MenubarContext.Provider value={{ openMenu, setOpenMenu }}>
        <div
          ref={ref}
          data-slot="menubar"
          className={cn('flex h-8 items-center gap-0.5 rounded-lg border p-[3px]', className)}
          {...props}
        >
          {children}
        </div>
      </MenubarContext.Provider>
    );
  }
);
Menubar.displayName = 'Menubar';

// --- MenubarMenu ---
export interface MenubarMenuProps {
  children: React.ReactNode;
  value?: string;
}

export const MenubarMenu = ({ children, value = Math.random().toString() }: MenubarMenuProps) => (
  <MenubarMenuContext.Provider value={value}>
    <div className="relative">{children}</div>
  </MenubarMenuContext.Provider>
);

// --- MenubarTrigger ---
export const MenubarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { openMenu, setOpenMenu } = React.useContext(MenubarContext);
    const menuId = React.useContext(MenubarMenuContext);
    const isOpen = openMenu === menuId;

    return (
      <button
        ref={ref}
        type="button"
        data-slot="menubar-trigger"
        aria-expanded={isOpen}
        onClick={(e) => { setOpenMenu(isOpen ? null : menuId); onClick?.(e); }}
        className={cn(
          'flex items-center rounded-sm px-1.5 py-[2px] text-sm font-medium outline-none select-none hover:bg-muted',
          isOpen && 'bg-muted',
          className
        )}
        {...props}
      />
    );
  }
);
MenubarTrigger.displayName = 'MenubarTrigger';

// --- MenubarContent ---
export const MenubarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { openMenu } = React.useContext(MenubarContext);
    const menuId = React.useContext(MenubarMenuContext);

    if (openMenu !== menuId) return null;

    return (
      <div
        ref={ref}
        data-slot="menubar-content"
        className={cn(
          'absolute top-full left-0 z-50 mt-1 min-w-36 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10',
          className
        )}
        {...props}
      />
    );
  }
);
MenubarContent.displayName = 'MenubarContent';

// --- MenubarItem ---
export interface MenubarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
  variant?: 'default' | 'destructive';
}

export const MenubarItem = React.forwardRef<HTMLDivElement, MenubarItemProps>(
  ({ className, inset, variant = 'default', ...props }, ref) => {
    const { setOpenMenu } = React.useContext(MenubarContext);
    return (
      <div
        ref={ref}
        data-slot="menubar-item"
        data-variant={variant}
        onClick={() => setOpenMenu(null)}
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
MenubarItem.displayName = 'MenubarItem';

// --- MenubarSeparator ---
export const MenubarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="menubar-separator" className={cn('-mx-1 my-1 h-px bg-border', className)} {...props} />
  )
);
MenubarSeparator.displayName = 'MenubarSeparator';

// --- MenubarShortcut ---
export const MenubarShortcut = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span ref={ref} data-slot="menubar-shortcut" className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)} {...props} />
  )
);
MenubarShortcut.displayName = 'MenubarShortcut';
