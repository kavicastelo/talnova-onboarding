import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from './utils';

export const Spinner = React.forwardRef<SVGSVGElement, React.SVGAttributes<SVGSVGElement>>(
  ({ className, ...props }, ref) => (
    <LoaderCircle
      ref={ref}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
);
Spinner.displayName = 'Spinner';
