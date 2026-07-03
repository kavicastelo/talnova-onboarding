import * as React from 'react';
import { cn } from './utils';

export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  size?: 'default' | 'sm';
}

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, checked: controlledChecked, defaultChecked, onCheckedChange, onChange, size = 'default', ...props }, ref) => {
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
        data-slot="switch"
        data-checked={checked || undefined}
        className={cn(
          'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-primary' : 'bg-input',
          size === 'default' ? 'h-5 w-9' : 'h-4 w-7',
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
        <span
          data-slot="switch-thumb"
          className={cn(
            'pointer-events-none block rounded-full bg-background ring-0 transition-transform',
            size === 'default' ? 'size-4' : 'size-3',
            checked ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'
          )}
        />
      </label>
    );
  }
);
Switch.displayName = 'Switch';

// CSwitch is an alias for Switch
export const CSwitch = Switch;
