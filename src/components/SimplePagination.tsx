import React from 'react';
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
  if (totalPages <= 1 && (!totalItems || totalItems <= (pageSize || 10))) {
    // If only 1 page and totalItems is small, still render informational text if totalItems is present, else hide if no data
    if (!totalItems || totalItems === 0) return null;
  }

  const effectiveStartIndex = startIndex !== undefined ? startIndex : totalItems === 0 ? 0 : (currentPage - 1) * (pageSize || 10) + 1;
  const effectiveEndIndex = endIndex !== undefined ? endIndex : Math.min(currentPage * (pageSize || 10), totalItems || 0);

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-xs text-muted-foreground ${className}`}
    >
      {/* Information text */}
      <div className="flex items-center gap-3">
        {totalItems !== undefined && (
          <span>
            Showing <span className="font-semibold text-foreground">{effectiveStartIndex}</span> to{' '}
            <span className="font-semibold text-foreground">{effectiveEndIndex}</span> of{' '}
            <span className="font-semibold text-foreground">{totalItems}</span> {itemLabel}
          </span>
        )}
        {showPageSizeSelector && pageSize && onPageSizeChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span>Per page:</span>
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
          title="First Page"
          aria-label="First Page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="px-3 font-medium text-foreground">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
          aria-label="Next Page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
          aria-label="Last Page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
