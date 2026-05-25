'use client';

import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface LayoutShellContextValue {
  desktopOpen: boolean;
  mobileOpen: boolean;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleSidebar: () => void;
}

const LayoutShellContext = createContext<LayoutShellContextValue | undefined>(
  undefined
);

export function LayoutShellProvider({ children }: { children: ReactNode }) {
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openMobileSidebar = useCallback(() => {
    setMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
    ) {
      setDesktopOpen((prev) => !prev);
      return;
    }
    setMobileOpen((prev) => !prev);
  }, []);

  const value = useMemo(
    () => ({
      desktopOpen,
      mobileOpen,
      openMobileSidebar,
      closeMobileSidebar,
      toggleSidebar,
    }),
    [desktopOpen, mobileOpen, openMobileSidebar, closeMobileSidebar, toggleSidebar]
  );

  return (
    <LayoutShellContext.Provider value={value}>
      {children}
    </LayoutShellContext.Provider>
  );
}

export function useLayoutShell(): LayoutShellContextValue {
  const context = useContext(LayoutShellContext);
  if (!context) {
    throw new Error('useLayoutShell must be used within a LayoutShellProvider');
  }
  return context;
}

