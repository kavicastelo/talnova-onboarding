import * as React from 'react';
import { cn } from './utils';

// --- Field ---
export const Field = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="field" className={cn('space-y-2', className)} {...props} />
  )
);
Field.displayName = 'Field';

// --- FieldGroup ---
export const FieldGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} data-slot="field-group" className={cn('space-y-4', className)} {...props} />
  )
);
FieldGroup.displayName = 'FieldGroup';

// --- FieldLabel ---
export const FieldLabel = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      data-slot="field-label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none data-[invalid]:text-destructive',
        className
      )}
      {...props}
    />
  )
);
FieldLabel.displayName = 'FieldLabel';

// --- FieldDescription ---
export const FieldDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} data-slot="field-description" className={cn('text-muted-foreground text-sm', className)} {...props} />
  )
);
FieldDescription.displayName = 'FieldDescription';

// --- FieldError ---
export interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  errors?: Array<{ message?: string } | undefined | null>;
}

export const FieldError = React.forwardRef<HTMLParagraphElement, FieldErrorProps>(
  ({ className, errors, ...props }, ref) => {
    const message = errors?.find((e) => e?.message)?.message;
    if (!message) return null;
    return (
      <p
        ref={ref}
        role="alert"
        data-slot="field-error"
        className={cn('text-destructive text-sm font-medium', className)}
        {...props}
      >
        {message}
      </p>
    );
  }
);
FieldError.displayName = 'FieldError';
