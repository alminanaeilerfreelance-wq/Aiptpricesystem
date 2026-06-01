'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { Box } from '@mui/material';
import { ToastProvider as HeroToastProvider } from '@heroui/toast';
import PermissionGate from '@/components/auth/PermissionGate';
import AppSidebar, { APP_DRAWER_WIDTH } from '@/components/layout/AppSidebar';
import {
  LayoutShellProvider,
  useLayoutShell,
} from '@/components/layout/LayoutShellContext';

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { desktopOpen } = useLayoutShell();

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F5F7FA' }}>
      <AppSidebar />
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
          ml: {
            xs: 0,
            lg: desktopOpen ? `${APP_DRAWER_WIDTH}px` : 0,
          },
          transition: (theme) =>
            theme.transitions.create('margin-left', {
              duration: theme.transitions.duration.standard,
              easing: theme.transitions.easing.sharp,
            }),
        }}
      >
        <PermissionGate>{children}</PermissionGate>
      </Box>
    </Box>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <LayoutShellProvider>
            <DashboardShell>{children}</DashboardShell>
            <HeroToastProvider placement="bottom-right" />
          </LayoutShellProvider>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
