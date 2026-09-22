import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Ellipsis } from 'lucide-react';
import { cn } from './utils';

export const Pagination = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const { t } = useTranslation('common');
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={props['aria-label'] || t('pagination.ariaLabel', 'Pagination')}
        className={cn('mx-auto flex w-full justify-center', className)}
        {...props}
      />
    );
  }
);
Pagination.displayName = 'Pagination';

export const PaginationContent = React.forwardRef<HTMLUListElement, React.HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
  )
);
PaginationContent.displayName = 'PaginationContent';

export const PaginationItem = React.forwardRef<HTMLLIElement, React.LiHTMLAttributes<HTMLLIElement>>(
  (props, ref) => <li ref={ref} {...props} />
);
PaginationItem.displayName = 'PaginationItem';

export interface PaginationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  isActive?: boolean;
}

export const PaginationLink = React.forwardRef<HTMLAnchorElement, PaginationLinkProps>(
  ({ className, isActive, ...props }, ref) => (
    <a
      ref={ref}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-sm font-medium whitespace-nowrap transition-all',
        isActive
          ? 'border border-border bg-background hover:bg-muted'
          : 'hover:bg-muted hover:text-foreground',
        className
      )}
      {...props}
    />
  )
);
PaginationLink.displayName = 'PaginationLink';

export const PaginationPrevious = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, children, ...props }, ref) => {
    const { t } = useTranslation('common');
    return (
      <a
        ref={ref}
        aria-label={props['aria-label'] || t('pagination.goToPrevious', 'Go to previous page')}
        className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium hover:bg-muted', className)}
        {...props}
      >
        <ChevronLeft className="size-4" />
        <span>{children || t('pagination.previous', 'Previous')}</span>
      </a>
    );
  }
);
PaginationPrevious.displayName = 'PaginationPrevious';

export const PaginationNext = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, children, ...props }, ref) => {
    const { t } = useTranslation('common');
    return (
      <a
        ref={ref}
        aria-label={props['aria-label'] || t('pagination.goToNext', 'Go to next page')}
        className={cn('inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-sm font-medium hover:bg-muted', className)}
        {...props}
      >
        <span>{children || t('pagination.next', 'Next')}</span>
        <ChevronRight className="size-4" />
      </a>
    );
  }
);
PaginationNext.displayName = 'PaginationNext';

export const PaginationEllipsis = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, children, ...props }, ref) => {
    const { t } = useTranslation('common');
    return (
      <span
        ref={ref}
        aria-hidden
        className={cn('flex size-8 items-center justify-center', className)}
        {...props}
      >
        <Ellipsis className="size-4" />
        <span className="sr-only">{children || t('pagination.morePages', 'More pages')}</span>
      </span>
    );
  }
);
PaginationEllipsis.displayName = 'PaginationEllipsis';
