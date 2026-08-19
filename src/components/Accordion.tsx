import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from './utils';

// --- Context ---
interface AccordionContextValue {
  openItems: string[];
  toggle: (value: string) => void;
  type: 'single' | 'multiple';
}

const AccordionContext = React.createContext<AccordionContextValue>({
  openItems: [],
  toggle: () => undefined,
  type: 'single',
});

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue>({
  value: '',
  isOpen: false,
});

// --- Accordion ---
export interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'single' | 'multiple';
  defaultValue?: string | string[];
  value?: string | string[];
  onValueChange?: (value: string | string[]) => void;
}

export const Accordion = React.forwardRef<HTMLDivElement, AccordionProps>(
  ({ className, type = 'single', defaultValue, children, ...props }, ref) => {
    const [openItems, setOpenItems] = React.useState<string[]>(
      defaultValue ? (Array.isArray(defaultValue) ? defaultValue : [defaultValue]) : []
    );

    const toggle = (value: string) => {
      setOpenItems((prev) =>
        type === 'single'
          ? prev.includes(value)
            ? []
            : [value]
          : prev.includes(value)
            ? prev.filter((v) => v !== value)
            : [...prev, value]
      );
    };

    return (
      <AccordionContext.Provider value={{ openItems, toggle, type }}>
        <div
          ref={ref}
          data-slot="accordion"
          className={cn('flex w-full flex-col', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = 'Accordion';

// --- AccordionItem ---
export interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { openItems } = React.useContext(AccordionContext);
    const isOpen = openItems.includes(value);

    return (
      <AccordionItemContext.Provider value={{ value, isOpen }}>
        <div
          ref={ref}
          data-slot="accordion-item"
          className={cn('border-b last:border-b-0', className)}
          {...props}
        >
          {children}
        </div>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = 'AccordionItem';

// --- AccordionTrigger ---
export type AccordionTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, AccordionTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { toggle } = React.useContext(AccordionContext);
    const { value, isOpen } = React.useContext(AccordionItemContext);

    return (
      <button
        ref={ref}
        type="button"
        data-slot="accordion-trigger"
        aria-expanded={isOpen}
        onClick={() => toggle(value)}
        className={cn(
          'flex flex-1 w-full items-start justify-between rounded-lg py-2.5 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
          className
        )}
        {...props}
      >
        {children}
        {isOpen ? (
          <ChevronUp className="ml-auto size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        )}
      </button>
    );
  }
);
AccordionTrigger.displayName = 'AccordionTrigger';

// --- AccordionContent ---
export type AccordionContentProps = React.HTMLAttributes<HTMLDivElement>

export const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => {
    const { isOpen } = React.useContext(AccordionItemContext);

    if (!isOpen) return null;

    return (
      <div ref={ref} data-slot="accordion-content" className="overflow-hidden text-sm" {...props}>
        <div className={cn('pt-0 pb-2.5', className)}>{children}</div>
      </div>
    );
  }
);
AccordionContent.displayName = 'AccordionContent';
