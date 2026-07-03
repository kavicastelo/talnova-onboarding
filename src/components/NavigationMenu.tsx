import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './utils';

// --- Context ---
interface NavigationMenuContextValue {
  openItem: string | null;
  setOpenItem: (item: string | null) => void;
}

const NavigationMenuContext = React.createContext<NavigationMenuContextValue>({
  openItem: null,
  setOpenItem: () => {},
});

const NavigationMenuItemContext = React.createContext<string>('');

// --- NavigationMenu ---
export const NavigationMenu = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => {
    const [openItem, setOpenItem] = React.useState<string | null>(null);
    return (
      <NavigationMenuContext.Provider value={{ openItem, setOpenItem }}>
        <nav
          ref={ref}
          data-slot="navigation-menu"
          className={cn('relative flex max-w-max flex-1 items-center justify-center', className)}
          {...props}
        >
          {children}
        </nav>
      </NavigationMenuContext.Provider>
    );
  }
);
NavigationMenu.displayName = 'NavigationMenu';

// --- NavigationMenuList ---
export const NavigationMenuList = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="navigation-menu-list"
      className={cn('group flex flex-1 list-none items-center justify-center gap-0', className)}
      {...props}
    />
  )
);
NavigationMenuList.displayName = 'NavigationMenuList';

// --- NavigationMenuItem ---
export interface NavigationMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  value?: string;
}

export const NavigationMenuItem = React.forwardRef<HTMLLIElement, NavigationMenuItemProps>(
  ({ className, value = Math.random().toString(), children, ...props }, ref) => (
    <NavigationMenuItemContext.Provider value={value}>
      <li ref={ref} data-slot="navigation-menu-item" className={cn('relative', className)} {...props}>
        {children}
      </li>
    </NavigationMenuItemContext.Provider>
  )
);
NavigationMenuItem.displayName = 'NavigationMenuItem';

// --- NavigationMenuTrigger ---
export const NavigationMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, children, onClick, ...props }, ref) => {
    const { openItem, setOpenItem } = React.useContext(NavigationMenuContext);
    const itemId = React.useContext(NavigationMenuItemContext);
    const isOpen = openItem === itemId;

    return (
      <button
        ref={ref}
        type="button"
        data-slot="navigation-menu-trigger"
        data-open={isOpen || undefined}
        onClick={(e) => { setOpenItem(isOpen ? null : itemId); onClick?.(e); }}
        className={cn(
          'group/navigation-menu-trigger inline-flex h-9 w-max items-center justify-center rounded-lg bg-background px-2.5 py-1.5 text-sm font-medium transition-all outline-none hover:bg-muted focus:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
          isOpen && 'bg-muted/50',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown
          className={cn('relative top-px ml-1 size-3 transition duration-300', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
    );
  }
);
NavigationMenuTrigger.displayName = 'NavigationMenuTrigger';

// --- NavigationMenuContent ---
export const NavigationMenuContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { openItem, setOpenItem } = React.useContext(NavigationMenuContext);
    const itemId = React.useContext(NavigationMenuItemContext);

    React.useEffect(() => {
      if (openItem !== itemId) return;
      const handler = (e: MouseEvent) => {
        if (!(e.target as Element).closest('[data-slot="navigation-menu"]')) {
          setOpenItem(null);
        }
      };
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }, [openItem, itemId, setOpenItem]);

    if (openItem !== itemId) return null;

    return (
      <div
        ref={ref}
        data-slot="navigation-menu-content"
        className={cn(
          'absolute top-full left-0 mt-1.5 w-max overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow ring-1 ring-foreground/10',
          className
        )}
        {...props}
      />
    );
  }
);
NavigationMenuContent.displayName = 'NavigationMenuContent';

// --- NavigationMenuLink ---
export const NavigationMenuLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a
      ref={ref}
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-lg p-2 text-sm transition-all outline-none hover:bg-muted focus:bg-muted [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
);
NavigationMenuLink.displayName = 'NavigationMenuLink';
