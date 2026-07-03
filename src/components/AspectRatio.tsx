import * as React from 'react';
import { cn } from './utils';

export interface AspectRatioProps extends React.HTMLAttributes<HTMLDivElement> {
  ratio?: number;
}

export const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(
  ({ className, ratio = 1, style, children, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="aspect-ratio"
      style={{ position: 'relative', paddingBottom: `${(1 / ratio) * 100}%`, ...style }}
      className={cn('overflow-hidden', className)}
      {...props}
    >
      <div className="absolute inset-0">{children}</div>
    </div>
  )
);
AspectRatio.displayName = 'AspectRatio';
