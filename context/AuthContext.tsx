'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authService } from '@/services/auth.service';
import type { ModulePermission } from '@/lib/permissions';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  permissions?: string[];
  modulePermissions?: ModulePermission[];
}

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // On mount, restore session from localStorage and refresh permissions.
  useEffect(() => {
    let cancelled = false;
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      try {
        const parsedUser: AuthUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);

        authService
          .getMe()
          .then((data) => {
            if (cancelled) return;
            const refreshedUser: AuthUser = {
              _id: data.user._id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              isActive: data.user.isActive,
              permissions: data.user.permissions,
              modulePermissions: data.user.modulePermissions,
            };
            localStorage.setItem('user', JSON.stringify(refreshedUser));
            setUser(refreshedUser);
          })
          .catch(() => {
            if (cancelled) return;
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setToken(null);
            setUser(null);
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
        return () => {
          cancelled = true;
        };
      } catch {
        // Corrupted storage — clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }

    setLoading(false);
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const data = await authService.login(email, password);
      const authUser: AuthUser = {
        _id: data.user._id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        isActive: data.user.isActive,
        permissions: data.user.permissions,
        modulePermissions: data.user.modulePermissions,
      };
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(authUser));
      setToken(data.token);
      setUser(authUser);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch {
      // Ignore errors — proceed with local cleanup regardless
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(token && user),
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
