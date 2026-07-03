import * as React from 'react';
import { Minus } from 'lucide-react';
import { cn } from './utils';

// --- Context ---
interface InputOTPContextValue {
  value: string;
  maxLength: number;
  activeIndex: number;
  setActiveIndex: (index: number) => void;
}

const InputOTPContext = React.createContext<InputOTPContextValue>({
  value: '',
  maxLength: 6,
  activeIndex: -1,
  setActiveIndex: () => {},
});

// --- InputOTP ---
export interface InputOTPProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  maxLength?: number;
  value?: string;
  onChange?: (value: string) => void;
  containerClassName?: string;
}

export const InputOTP = React.forwardRef<HTMLDivElement, InputOTPProps>(
  ({ className, maxLength = 6, value: controlledValue, onChange, containerClassName, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState('');
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const value = controlledValue !== undefined ? controlledValue : internalValue;
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value.replace(/[^0-9]/g, '').slice(0, maxLength);
      if (controlledValue === undefined) setInternalValue(next);
      onChange?.(next);
      setActiveIndex(Math.min(next.length, maxLength - 1));
    };

    return (
      <InputOTPContext.Provider value={{ value, maxLength, activeIndex, setActiveIndex }}>
        <div
          ref={ref}
          data-slot="input-otp"
          className={cn('flex items-center has-[:disabled]:opacity-50', containerClassName)}
          onClick={() => inputRef.current?.focus()}
          {...props}
        >
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            value={value}
            onChange={handleChange}
            onFocus={() => setActiveIndex(Math.min(value.length, maxLength - 1))}
            onBlur={() => setActiveIndex(-1)}
            className="sr-only absolute"
            maxLength={maxLength}
          />
          {children}
        </div>
      </InputOTPContext.Provider>
    );
  }
);
InputOTP.displayName = 'InputOTP';

// --- InputOTPGroup ---
export const InputOTPGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="input-otp-group"
      className={cn('flex items-center rounded-lg', className)}
      {...props}
    />
  )
);
InputOTPGroup.displayName = 'InputOTPGroup';

// --- InputOTPSlot ---
export interface InputOTPSlotProps extends React.HTMLAttributes<HTMLDivElement> {
  index: number;
}

export const InputOTPSlot = React.forwardRef<HTMLDivElement, InputOTPSlotProps>(
  ({ className, index, ...props }, ref) => {
    const { value, activeIndex } = React.useContext(InputOTPContext);
    const char = value[index] || '';
    const isActive = index === activeIndex;

    return (
      <div
        ref={ref}
        data-slot="input-otp-slot"
        data-active={isActive || undefined}
        className={cn(
          'relative flex size-8 items-center justify-center border-y border-r border-input text-sm transition-all first:rounded-l-lg first:border-l last:rounded-r-lg',
          isActive && 'z-10 border-ring ring-[3px] ring-ring/50',
          className
        )}
        {...props}
      >
        {char}
        {isActive && !char && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-4 w-px animate-pulse bg-foreground" />
          </div>
        )}
      </div>
    );
  }
);
InputOTPSlot.displayName = 'InputOTPSlot';

// --- InputOTPSeparator ---
export const InputOTPSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => (
    <div
      ref={ref}
      data-slot="input-otp-separator"
      role="separator"
      className="flex items-center [&_svg:not([class*='size-'])]:size-4"
      {...props}
    >
      <Minus />
    </div>
  )
);
InputOTPSeparator.displayName = 'InputOTPSeparator';
