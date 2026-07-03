import * as React from 'react';
import { cn } from './utils';

// --- Alert ---
const alertVariants = {
  default: 'bg-card text-card-foreground',
  destructive:
    "bg-card text-destructive [&>[data-slot=alert-description]]:text-destructive/90 [&>svg]:text-current",
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive';
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <div
      ref={ref}
      role="alert"
      data-slot="alert"
      className={cn(
        "relative grid w-full gap-0.5 rounded-lg border px-2.5 py-2 text-left text-sm has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 [&>svg]:row-span-2 [&>svg]:translate-y-0.5 [&>svg]:text-current [&_svg:not([class*='size-'])]:size-4",
        alertVariants[variant],
        className
      )}
      {...props}
    />
  )
);
Alert.displayName = 'Alert';

// --- AlertTitle ---
export const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="alert-title" className={cn('font-medium', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

// --- AlertDescription ---
export const AlertDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="alert-description"
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
AlertDescription.displayName = 'AlertDescription';

// --- AlertAction ---
export const AlertAction = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="alert-action" className={cn('col-start-2 mt-1', className)} {...props} />
  )
);
AlertAction.displayName = 'AlertAction';
