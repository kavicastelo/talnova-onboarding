import * as React from 'react';
import { Slot } from './Slot';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut
} from '../_designSystem/ds-6551b66a-cfd3-4df9-a9b1-9ead8d7fe7e9';

export {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut
};

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export const DropdownMenu: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
  className?: string;
}

export const DropdownMenuTrigger = React.forwardRef<any, DropdownMenuTriggerProps>(
  ({ children, asChild, className = '', ...props }, ref) => {
    const context = React.useContext(DropdownMenuContext);
    if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      context.setOpen(!context.open);
    };

    if (asChild) {
      return (
        <Slot
          ref={ref}
          onClick={handleClick}
          aria-expanded={context.open}
          className={className}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        aria-expanded={context.open}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

export interface DropdownMenuContentProps {
  children: React.ReactNode;
  className?: string;
  align?: 'start' | 'end';
}

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  className = '',
  align = 'start',
  ...props
}) => {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  if (!context.open) return null;

  const alignClass = align === 'end' ? 'right-0' : 'left-0';
  const mergedClass = [
    "absolute z-50 mt-1 min-w-48 overflow-hidden rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 focus:outline-none",
    alignClass,
    className
  ].filter(Boolean).join(' ');

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[role="menuitem"]') || target.closest('button') || target.closest('a')) {
      context.setOpen(false);
    }
  };

  return (
    <div 
      className={mergedClass} 
      onClick={handleContentClick}
      {...props}
    >
      {children}
    </div>
  );
};
