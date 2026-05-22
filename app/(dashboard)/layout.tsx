'use client';

import React from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import AppSidebar from '@/components/layout/AppSidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <SettingsProvider>
        <ToastProvider>
          <div className="flex min-h-screen">
            <AppSidebar />
            <main className="flex-1 ml-64 bg-surface min-h-screen">
              {children}
            </main>
          </div>
        </ToastProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
