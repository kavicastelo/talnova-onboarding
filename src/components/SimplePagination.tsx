import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

export interface SimplePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  startIndex?: number;
  endIndex?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  className?: string;
  showPageSizeSelector?: boolean;
}

export const SimplePagination: React.FC<SimplePaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  className = '',
  showPageSizeSelector = true,
}) => {
  const { t } = useTranslation('common');

  if (totalPages <= 1 && (!totalItems || totalItems <= (pageSize || 10))) {
    // If only 1 page and totalItems is small, still render informational text if totalItems is present, else hide if no data
    if (!totalItems || totalItems === 0) return null;
  }

  const effectiveStartIndex = startIndex !== undefined ? startIndex : totalItems === 0 ? 0 : (currentPage - 1) * (pageSize || 10) + 1;
  const effectiveEndIndex = endIndex !== undefined ? endIndex : Math.min(currentPage * (pageSize || 10), totalItems || 0);

  const firstPageLabel = t('pagination.firstPage', 'First Page');
  const prevPageLabel = t('pagination.previousPage', 'Previous Page');
  const nextPageLabel = t('pagination.nextPage', 'Next Page');
  const lastPageLabel = t('pagination.lastPage', 'Last Page');

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-xs text-muted-foreground ${className}`}
    >
      {/* Information text */}
      <div className="flex items-center gap-3">
        {totalItems !== undefined && (
          <span>
            {t('pagination.showing', {
              from: effectiveStartIndex,
              to: effectiveEndIndex,
              total: totalItems,
              defaultValue: `Showing ${effectiveStartIndex} to ${effectiveEndIndex} of ${totalItems} results`
            })}
            {itemLabel && itemLabel !== 'items' && itemLabel !== 'results' ? ` ${itemLabel}` : ''}
          </span>
        )}
        {showPageSizeSelector && pageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span>{t('pagination.perPage', 'Per page:')}</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 py-0 text-xs rounded border border-input bg-background font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Pagination Action Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(1)}
          disabled={currentPage <= 1}
          title={firstPageLabel}
          aria-label={firstPageLabel}
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title={prevPageLabel}
          aria-label={prevPageLabel}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="px-3 font-medium text-foreground">
          {t('pagination.page', {
            page: currentPage,
            totalPages,
            defaultValue: `Page ${currentPage} of ${totalPages}`
          })}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title={nextPageLabel}
          aria-label={nextPageLabel}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title={lastPageLabel}
          aria-label={lastPageLabel}
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
