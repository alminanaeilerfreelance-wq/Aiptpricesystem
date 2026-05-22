'use client';

import { useAuthContext, AuthContextValue } from '@/context/AuthContext';

/**
 * Hook to access the authentication context.
 * Must be used within an AuthProvider — throws if called outside of one.
 */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}

export default useAuth;
