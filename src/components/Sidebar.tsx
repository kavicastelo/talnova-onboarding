import * as React from 'react';
import { Slot } from './Slot';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
} from '../_designSystem/ds-6551b66a-cfd3-4df9-a9b1-9ead8d7fe7e9';

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger
};

const baseSidebarBtnClasses = "peer/menu-button group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-none transition-[width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-sidebar-accent data-[active]:font-medium data-[active]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0 [&>span:last-child]:truncate";

const btnVariants: Record<string, string> = {
  default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
  outline: "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
};

const btnSizes: Record<string, string> = {
  default: "h-8 text-sm",
  sm: "h-7 text-xs",
  lg: "h-12 text-sm"
};

export interface SidebarMenuButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  isActive?: boolean;
  asChild?: boolean;
  tooltip?: string;
}

export const SidebarMenuButton = React.forwardRef<HTMLButtonElement, SidebarMenuButtonProps>(
  ({ className = '', variant = 'default', size = 'default', isActive = false, asChild = false, tooltip, ...props }, ref) => {
    const variantClass = btnVariants[variant] || btnVariants.default;
    const sizeClass = btnSizes[size] || btnSizes.default;
    const mergedClass = [baseSidebarBtnClasses, variantClass, sizeClass, className].filter(Boolean).join(' ');

    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={mergedClass}
          data-slot="sidebar-menu-button"
          data-active={isActive ? 'true' : undefined}
          {...props}
        />
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        className={mergedClass}
        data-slot="sidebar-menu-button"
        data-active={isActive ? 'true' : undefined}
        {...props}
      />
    );
  }
);

SidebarMenuButton.displayName = 'SidebarMenuButton';
