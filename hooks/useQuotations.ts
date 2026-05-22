'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  quotationsService,
  Quotation,
  QuotationListParams,
} from '@/services/quotations.service';

export interface UseQuotationsResult {
  quotations: Quotation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook that fetches and manages a list of quotations.
 * Accepts optional filters for status and search terms.
 * Re-fetches automatically when filter values change.
 */
export function useQuotations(filters?: QuotationListParams): UseQuotationsResult {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuotations = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await quotationsService.list(filters);
      setQuotations(response.quotations);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load quotations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  return {
    quotations,
    loading,
    error,
    refetch: fetchQuotations,
  };
}

export default useQuotations;
