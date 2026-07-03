import * as React from 'react';
import { cn } from './utils';

export const ResizablePanelGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { direction?: 'horizontal' | 'vertical' }
>(({ className, direction = 'horizontal', ...props }, ref) => (
  <div
    ref={ref}
    data-slot="resizable-panel-group"
    aria-orientation={direction === 'horizontal' ? 'horizontal' : 'vertical'}
    className={cn('flex h-full w-full', direction === 'vertical' && 'flex-col', className)}
    {...props}
  />
));
ResizablePanelGroup.displayName = 'ResizablePanelGroup';

// Alias
export const Resizable = ResizablePanelGroup;

export const ResizablePanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { defaultSize?: number }
>(({ className, defaultSize = 50, style, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="resizable-panel"
    className={cn('flex-1 overflow-auto', className)}
    style={{ flexBasis: `${defaultSize}%`, ...style }}
    {...props}
  />
));
ResizablePanel.displayName = 'ResizablePanel';

export const ResizableHandle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { withHandle?: boolean }
>(({ className, withHandle, ...props }, ref) => (
  <div
    ref={ref}
    data-slot="resizable-handle"
    className={cn(
      'relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
      'aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full',
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
    )}
  </div>
));
ResizableHandle.displayName = 'ResizableHandle';
