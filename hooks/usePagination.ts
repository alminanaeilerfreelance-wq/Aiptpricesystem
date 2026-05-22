'use client';

import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationResult<T> {
  currentPage: number;
  totalPages: number;
  paginatedItems: T[];
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
}

/**
 * Hook that paginates an array of items client-side.
 *
 * @param items        - The full array of items to paginate.
 * @param itemsPerPage - Number of items shown per page (default: 20).
 * @returns Pagination state and navigation helpers.
 */
export function usePagination<T>(
  items: T[],
  itemsPerPage: number = 20
): UsePaginationResult<T> {
  const [currentPage, setCurrentPage] = useState<number>(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(items.length / itemsPerPage)),
    [items.length, itemsPerPage]
  );

  // Clamp currentPage whenever items or itemsPerPage change
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, safePage, itemsPerPage]);

  const setPage = useCallback(
    (page: number) => {
      const clamped = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(clamped);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  return {
    currentPage: safePage,
    totalPages,
    paginatedItems,
    setPage,
    nextPage,
    prevPage,
  };
}

export default usePagination;
