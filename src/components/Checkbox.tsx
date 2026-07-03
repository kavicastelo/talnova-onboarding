import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from './utils';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked: controlledChecked, defaultChecked, onCheckedChange, onChange, ...props }, ref) => {
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
    const checked = controlledChecked !== undefined ? controlledChecked : internalChecked;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.checked;
      if (controlledChecked === undefined) setInternalChecked(value);
      onChange?.(e);
      onCheckedChange?.(value);
    };

    return (
      <label
        data-slot="checkbox"
        data-checked={checked || undefined}
        className={cn(
          'peer relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-input transition-colors outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground dark:bg-input/30 dark:data-[checked]:bg-primary',
          className
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="sr-only"
          {...props}
        />
        {checked && <Check className="size-3.5" />}
      </label>
    );
  }
);
Checkbox.displayName = 'Checkbox';
