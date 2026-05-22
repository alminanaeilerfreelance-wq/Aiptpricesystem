'use client';

import { useState, useEffect } from 'react';

/**
 * Debounces a value, returning the latest value only after
 * the specified delay has elapsed since the last change.
 *
 * @param value - The value to debounce.
 * @param delay - Debounce delay in milliseconds (default: 300).
 * @returns The debounced value.
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
