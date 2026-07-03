import * as React from 'react';

import { cn } from './utils';

// --- Context ---
interface RadioGroupContextValue {
  value: string;
  name?: string;
  onValueChange?: (value: string) => void;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({ value: '' });

// --- RadioGroup ---
export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
}

export const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value: controlledValue, defaultValue, onValueChange, name, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue ?? '');
    const value = controlledValue !== undefined ? controlledValue : internalValue;

    const handleChange = (v: string) => {
      if (controlledValue === undefined) setInternalValue(v);
      onValueChange?.(v);
    };

    return (
      <RadioGroupContext.Provider value={{ value, name, onValueChange: handleChange }}>
        <div
          ref={ref}
          data-slot="radio-group"
          role="radiogroup"
          className={cn('grid w-full gap-2', className)}
          {...props}
        >
          {children}
        </div>
      </RadioGroupContext.Provider>
    );
  }
);
RadioGroup.displayName = 'RadioGroup';

// --- RadioGroupItem ---
export interface RadioGroupItemProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  value: string;
}

export const RadioGroupItem = React.forwardRef<HTMLInputElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext);
    const checked = ctx.value === value;

    return (
      <label
        data-slot="radio-group-item"
        data-checked={checked || undefined}
        className={cn(
          'relative flex aspect-square size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-input outline-none transition-colors',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          checked && 'border-primary bg-primary text-primary-foreground dark:bg-primary',
          'dark:bg-input/30',
          className
        )}
      >
        <input
          ref={ref}
          type="radio"
          name={ctx.name}
          value={value}
          checked={checked}
          onChange={() => ctx.onValueChange?.(value)}
          className="sr-only"
          {...props}
        />
        {checked && (
          <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-foreground" />
        )}
      </label>
    );
  }
);
RadioGroupItem.displayName = 'RadioGroupItem';
