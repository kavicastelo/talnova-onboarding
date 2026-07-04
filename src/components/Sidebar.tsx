import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { cn } from './utils';
import { Slot } from './Slot';

// --- Constants ---
const SIDEBAR_WIDTH = '16rem';
const SIDEBAR_WIDTH_ICON = '3rem';

// --- Context ---
interface SidebarContextValue {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isMobile: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  state: 'expanded',
  open: true,
  setOpen: () => {},
  toggleSidebar: () => {},
  isMobile: false,
});

export function useSidebar() {
  const ctx = React.useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider.');
  return ctx;
}

// --- SidebarProvider ---
export interface SidebarProviderProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const SidebarProvider = React.forwardRef<HTMLDivElement, SidebarProviderProps>(
  ({ defaultOpen = true, open: controlledOpen, onOpenChange, className, style, children, ...props }, ref) => {
    const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
    const open = controlledOpen ?? internalOpen;
    const [isMobile, setIsMobile] = React.useState(false);

    const setOpen = (value: boolean) => {
      if (controlledOpen === undefined) setInternalOpen(value);
      else onOpenChange?.(value);
    };

    const toggleSidebar = () => setOpen(!open);
    const state: 'expanded' | 'collapsed' = open ? 'expanded' : 'collapsed';

    React.useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'b' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          toggleSidebar();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [open]);

    React.useEffect(() => {
      const mql = window.matchMedia('(max-width: 768px)');
      const onChange = () => {
        setIsMobile(mql.matches);
        if (mql.matches) {
          setInternalOpen(false); // Collapse by default on mobile
        }
      };
      mql.addEventListener('change', onChange);
      setIsMobile(mql.matches);
      if (mql.matches) {
        setInternalOpen(false);
      }
      return () => mql.removeEventListener('change', onChange);
    }, []);

    return (
      <SidebarContext.Provider value={{ state, open, setOpen, toggleSidebar, isMobile }}>
        <div
          ref={ref}
          data-slot="sidebar-wrapper"
          style={{ '--sidebar-width': SIDEBAR_WIDTH, '--sidebar-width-icon': SIDEBAR_WIDTH_ICON, ...style } as React.CSSProperties}
          className={cn(
            'group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = 'SidebarProvider';

// --- Sidebar ---
export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'offcanvas' | 'icon' | 'none';
}

export const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ side = 'left', variant = 'sidebar', collapsible = 'offcanvas', className, children, ...props }, ref) => {
    const { state, open, setOpen, isMobile } = useSidebar();

    if (collapsible === 'none') {
      return (
        <div
          ref={ref}
          data-slot="sidebar"
          className={cn('flex h-full w-[var(--sidebar-width)] flex-col bg-sidebar text-sidebar-foreground', className)}
          {...props}
        >
          {children}
        </div>
      );
    }

    return (
      <>
        {isMobile && open && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
            onClick={() => setOpen(false)}
          />
        )}
        <div
          className="group peer text-sidebar-foreground"
          data-state={state}
          data-collapsible={state === 'collapsed' ? collapsible : ''}
          data-variant={variant}
          data-side={side}
          data-slot="sidebar"
        >
          {/* Gap placeholder */}
          <div
            data-slot="sidebar-gap"
            className={cn(
              'relative w-[var(--sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear',
              isMobile
                ? 'w-0'
                : 'group-data-[collapsible=offcanvas]:w-0 group-data-[side=right]:rotate-180 group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]'
            )}
          />
          {/* Fixed container */}
          <div
            ref={ref}
            data-slot="sidebar-container"
            data-side={side}
            className={cn(
              'fixed inset-y-0 z-50 flex h-svh w-[var(--sidebar-width)] transition-[left,right,width] duration-200 ease-linear data-[side=left]:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] data-[side=right]:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',
              isMobile
                ? (open 
                    ? (side === 'left' ? 'left-0' : 'right-0') 
                    : (side === 'left' ? 'left-[calc(var(--sidebar-width)*-1)]' : 'right-[calc(var(--sidebar-width)*-1)]')
                  )
                : 'data-[side=left]:left-0 data-[side=right]:right-0 group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)] group-data-[side=left]:border-r group-data-[side=right]:border-l',
              className
            )}
            {...props}
          >
            <div
              data-sidebar="sidebar"
              data-slot="sidebar-inner"
              className="flex size-full flex-col bg-sidebar"
            >
              {children}
            </div>
          </div>
        </div>
      </>
    );
  }
);
Sidebar.displayName = 'Sidebar';

// --- SidebarTrigger ---
export const SidebarTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-trigger"
        onClick={(e) => { onClick?.(e); toggleSidebar(); }}
        className={cn('inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted', className)}
        {...props}
      >
        <PanelLeft className="size-4" />
      </button>
    );
  }
);
SidebarTrigger.displayName = 'SidebarTrigger';

// --- SidebarInset ---
export const SidebarInset = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => (
    <main
      ref={ref}
      data-slot="sidebar-inset"
      className={cn('relative flex w-full flex-1 flex-col bg-background', className)}
      {...props}
    />
  )
);
SidebarInset.displayName = 'SidebarInset';

// --- Layout sub-components ---
export const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
  )
);
SidebarHeader.displayName = 'SidebarHeader';

export const SidebarFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
  )
);
SidebarFooter.displayName = 'SidebarFooter';

export const SidebarSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-separator" className={cn('mx-2 h-px w-auto bg-sidebar-border', className)} {...props} />
  )
);
SidebarSeparator.displayName = 'SidebarSeparator';

export const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-content"
      className={cn('flex min-h-0 flex-1 flex-col gap-0 overflow-auto group-data-[collapsible=icon]:overflow-hidden', className)}
      {...props}
    />
  )
);
SidebarContent.displayName = 'SidebarContent';

export const SidebarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-group" className={cn('relative flex w-full min-w-0 flex-col p-2', className)} {...props} />
  )
);
SidebarGroup.displayName = 'SidebarGroup';

export const SidebarGroupLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0 [&>svg]:size-4 [&>svg]:shrink-0',
        className
      )}
      {...props}
    />
  )
);
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="sidebar-group-content" className={cn('w-full text-sm', className)} {...props} />
  )
);
SidebarGroupContent.displayName = 'SidebarGroupContent';

export const SidebarMenu = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} data-slot="sidebar-menu" className={cn('flex w-full min-w-0 flex-col gap-0', className)} {...props} />
  )
);
SidebarMenu.displayName = 'SidebarMenu';

export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="sidebar-menu-item" className={cn('group/menu-item relative', className)} {...props} />
  )
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  isActive?: boolean;
  asChild?: boolean;
  tooltip?: string;
}

const sidebarMenuButtonBase =
  "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-none transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate";

const sidebarMenuButtonVariants: Record<string, string> = {
  default: 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
  outline: 'bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
};
const sidebarMenuButtonSizes: Record<string, string> = {
  default: 'h-8 text-sm',
  sm: 'h-7 text-xs',
  lg: 'h-12 text-sm',
};

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className, variant = 'default', size = 'default', isActive = false, asChild = false, ...props }, ref) => {
    const classes = cn(
      sidebarMenuButtonBase,
      sidebarMenuButtonVariants[variant],
      sidebarMenuButtonSizes[size],
      className
    );

    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={classes}
          data-slot="sidebar-menu-button"
          data-active={isActive || undefined}
          {...props}
        />
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-menu-button"
        data-active={isActive || undefined}
        className={classes}
        {...props}
      />
    );
  }
);
SidebarMenuButton.displayName = 'SidebarMenuButton';

export const SidebarMenuBadge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="sidebar-menu-badge"
      className={cn(
        'pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
);
SidebarMenuBadge.displayName = 'SidebarMenuBadge';

export const SidebarMenuSub = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul
      ref={ref}
      data-slot="sidebar-menu-sub"
      className={cn(
        'mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[collapsible=icon]:hidden',
        className
      )}
      {...props}
    />
  )
);
SidebarMenuSub.displayName = 'SidebarMenuSub';

export const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} data-slot="sidebar-menu-sub-item" className={cn('group/menu-sub-item relative', className)} {...props} />
  )
);
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem';

export interface SidebarMenuSubButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
  size?: 'sm' | 'md';
}

export const SidebarMenuSubButton = React.forwardRef<HTMLAnchorElement, SidebarMenuSubButtonProps>(
  ({ className, isActive = false, size = 'md', ...props }, ref) => (
    <a
      ref={ref}
      data-slot="sidebar-menu-sub-button"
      data-active={isActive || undefined}
      data-size={size}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[size=md]:text-sm data-[size=sm]:text-xs data-[active]:bg-sidebar-accent data-[active]:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0',
        className
      )}
      {...props}
    />
  )
);
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton';

export const SidebarRail = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    const { toggleSidebar } = useSidebar();
    return (
      <button
        ref={ref}
        type="button"
        data-slot="sidebar-rail"
        aria-label="Toggle Sidebar"
        tabIndex={-1}
        onClick={toggleSidebar}
        className={cn(
          'absolute inset-y-0 z-20 hidden w-4 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:start-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex',
          className
        )}
        {...props}
      />
    );
  }
);
SidebarRail.displayName = 'SidebarRail';
