import { useState, useMemo, useEffect } from 'react';

export interface UsePaginationOptions<T> {
  data?: T[];
  initialPageSize?: number;
  initialPage?: number;
}

export interface UsePaginationReturn<T> {
  page: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalItems: number;
  totalPages: number;
  paginatedData: T[];
  startIndex: number;
  endIndex: number;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;
}

export function usePagination<T = any>({
  data = [],
  initialPageSize = 10,
  initialPage = 1,
}: UsePaginationOptions<T> = {}): UsePaginationReturn<T> {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Auto-reset page if current page exceeds total pages after data filter changes
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [totalItems, totalPages, page]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, page, pageSize]);

  const startIndex = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalItems);

  const setPageSize = (newSize: number) => {
    setPageSizeState(newSize);
    setPage(1);
  };

  const nextPage = () => setPage((p) => Math.min(p + 1, totalPages));
  const prevPage = () => setPage((p) => Math.max(p - 1, 1));
  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    totalItems,
    totalPages,
    paginatedData,
    startIndex,
    endIndex,
    nextPage,
    prevPage,
    goToPage,
  };
}
