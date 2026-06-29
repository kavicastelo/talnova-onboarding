import * as React from 'react';
import { Slot } from './Slot';
import { ButtonGroup } from '../_designSystem/ds-6551b66a-cfd3-4df9-a9b1-9ead8d7fe7e9';

export { ButtonGroup };

const baseClasses = "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const variants: Record<string, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  outline: "border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
  destructive: "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
  link: "text-primary underline-offset-4 hover:underline"
};

const sizes: Record<string, string> = {
  default: "h-8 gap-1.5 px-2.5 has-[[data-icon=inline-end]]:pr-2 has-[[data-icon=inline-start]]:pl-2",
  xs: "h-6 gap-1 rounded-md px-2 text-xs has-[[data-icon=inline-end]]:pr-1.5 has-[[data-icon=inline-start]]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
  sm: "h-7 gap-1 rounded-md px-2.5 text-[0.8rem] has-[[data-icon=inline-end]]:pr-1.5 has-[[data-icon=inline-start]]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
  lg: "h-9 gap-1.5 px-2.5 has-[[data-icon=inline-end]]:pr-3 has-[[data-icon=inline-start]]:pl-3",
  icon: "size-8",
  "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
  "icon-sm": "size-7 rounded-md",
  "icon-lg": "size-9"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', asChild = false, type = 'button', ...props }, ref) => {
    const variantClass = variants[variant] || variants.default;
    const sizeClass = sizes[size] || sizes.default;
    const mergedClass = [baseClasses, variantClass, sizeClass, className].filter(Boolean).join(' ');

    if (asChild) {
      return (
        <Slot ref={ref} className={mergedClass} {...props} />
      );
    }

    return (
      <button
        ref={ref}
        type={type}
        className={mergedClass}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
