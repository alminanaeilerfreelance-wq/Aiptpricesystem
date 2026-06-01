'use client';

import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { usePermission } from '@/hooks/usePermission';
import type { Resource, ResourceAction } from '@/lib/permissions';

interface RequiredPermission {
  module: Resource;
  action: ResourceAction;
}

const PAGE_PERMISSIONS: Array<[RegExp, RequiredPermission]> = [
  [/^\/dashboard$/, { module: 'dashboard', action: 'view' }],
  [/^\/quotations\/new$/, { module: 'quotations', action: 'add' }],
  [/^\/quotations\/[^/]+\/edit$/, { module: 'quotations', action: 'update' }],
  [/^\/quotations(\/.*)?$/, { module: 'quotations', action: 'view' }],
  [/^\/client-quotations(\/.*)?$/, { module: 'client-quotations', action: 'view' }],
  [/^\/associate-quotations(\/.*)?$/, { module: 'associate-quotations', action: 'view' }],
  [/^\/inquires(\/.*)?$/, { module: 'inquiries', action: 'view' }],
  [/^\/procedures(\/.*)?$/, { module: 'procedures', action: 'view' }],
  [/^\/requirements(\/.*)?$/, { module: 'requirements', action: 'view' }],
  [/^\/pricing-rules(\/.*)?$/, { module: 'pricing-rules', action: 'view' }],
  [/^\/reports(\/.*)?$/, { module: 'reports', action: 'view' }],
  [/^\/profit-loss-analysis$/, { module: 'profit-loss-analysis', action: 'view' }],
  [/^\/clients(\/.*)?$/, { module: 'clients', action: 'view' }],
  [/^\/associte(\/.*)?$/, { module: 'associates', action: 'view' }],
  [/^\/own-offices(\/.*)?$/, { module: 'own-offices', action: 'view' }],
  [/^\/company-details(\/.*)?$/, { module: 'company-details', action: 'view' }],
  [/^\/departments(\/.*)?$/, { module: 'departments', action: 'view' }],
  [/^\/services(\/.*)?$/, { module: 'services', action: 'view' }],
  [/^\/countries(\/.*)?$/, { module: 'countries', action: 'view' }],
  [/^\/continents(\/.*)?$/, { module: 'continents', action: 'view' }],
  [/^\/classification-of-fees(\/.*)?$/, { module: 'classification-of-fees', action: 'view' }],
  [/^\/client-types(\/.*)?$/, { module: 'client-types', action: 'view' }],
  [/^\/settings$/, { module: 'settings', action: 'view' }],
  [/^\/users(\/.*)?$/, { module: 'users', action: 'view' }],
  [/^\/roles(\/.*)?$/, { module: 'roles', action: 'view' }],
];

function getRequiredPermission(pathname: string): RequiredPermission | null {
  return PAGE_PERMISSIONS.find(([pattern]) => pattern.test(pathname))?.[1] || null;
}

export function PermissionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading } = useAuth();
  const { can } = usePermission();
  const required = getRequiredPermission(pathname);

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={30} />
      </Box>
    );
  }

  if (required && !can(required.action, required.module)) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          px: 3,
          textAlign: 'center',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
            Forbidden
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            You do not have permission to view this page.
          </Typography>
          <Button component={Link} href="/dashboard" variant="contained">
            Back to Dashboard
          </Button>
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
}

export default PermissionGate;
