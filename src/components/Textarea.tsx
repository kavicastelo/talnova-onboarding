import * as React from 'react';
import { cn } from './utils';
import { sanitizeTextarea } from '../utils/inputSanitizer';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  sanitize?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, maxLength, onChange, onBlur, sanitize = true, ...props }, ref) => {
    const effectiveMaxLength = maxLength ?? 5000;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (sanitize && typeof e.target.value === 'string') {
        e.target.value = sanitizeTextarea(e.target.value, effectiveMaxLength);
      }
      onChange?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      if (sanitize && typeof e.target.value === 'string') {
        e.target.value = sanitizeTextarea(e.target.value, effectiveMaxLength);
      }
      onBlur?.(e);
    };

    return (
      <textarea
        ref={ref}
        maxLength={effectiveMaxLength}
        onChange={handleChange}
        onBlur={handleBlur}
        data-slot="textarea"
        className={cn(
          "flex min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';
