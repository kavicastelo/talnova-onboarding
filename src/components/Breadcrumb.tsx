import * as React from 'react';
import { Slot } from './Slot';
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '../_designSystem/ds-6551b66a-cfd3-4df9-a9b1-9ead8d7fe7e9';

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
};

export interface BreadcrumbLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  asChild?: boolean;
}

export const BreadcrumbLink = React.forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ className = '', asChild = false, ...props }, ref) => {
    const mergedClass = [
      "transition-colors hover:text-foreground text-muted-foreground",
      className
    ].filter(Boolean).join(' ');

    if (asChild) {
      return (
        <Slot ref={ref} className={mergedClass} {...props} />
      );
    }

    return (
      <a
        ref={ref}
        className={mergedClass}
        {...props}
      />
    );
  }
);

BreadcrumbLink.displayName = 'BreadcrumbLink';
