'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutShell } from './LayoutShellContext';

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface TopbarProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  userName?: string;
  userEmail?: string;
  className?: string;
}

const BurgerIcon = () => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    sx={{ width: 22, height: 22, strokeWidth: 2 }}
    aria-hidden="true"
  >
    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
  </Box>
);

const Topbar: React.FC<TopbarProps> = ({
  title,
  breadcrumbs,
  userName,
  userEmail,
  className,
}) => {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { toggleSidebar } = useLayoutShell();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const resolvedName = userName ?? user?.name ?? 'Admin User';
  const resolvedEmail = userEmail ?? user?.email ?? '';

  const initials = useMemo(
    () =>
      resolvedName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    [resolvedName]
  );

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (path: string) => {
    handleCloseMenu();
    router.push(path);
  };

  const handleLogout = async () => {
    handleCloseMenu();
    try {
      await logout();
    } catch {
      // continue with redirect even if logout API fails
    } finally {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
      router.push('/login');
    }
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      color="inherit"
      className={clsx(className)}
      sx={{
        borderBottom: '1px solid #E5E7EB',
        backgroundColor: '#ffffff',
        color: '#0F172A',
        zIndex: (theme) => theme.zIndex.drawer - 1,
      }}
    >
      <Toolbar sx={{ minHeight: '64px !important', px: { xs: 2, sm: 3 }, gap: 1.5 }}>
        <IconButton
          color="inherit"
          edge="start"
          onClick={toggleSidebar}
          aria-label="Open or close navigation drawer"
          sx={{ border: '1px solid #E2E8F0', borderRadius: 2 }}
        >
          <BurgerIcon />
        </IconButton>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <Box
              component="nav"
              aria-label="Breadcrumb"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}
            >
              {breadcrumbs.map((crumb, index) => (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 && (
                    <Typography
                      component="span"
                      sx={{ fontSize: '0.72rem', color: '#94A3B8' }}
                    >
                      /
                    </Typography>
                  )}
                  {crumb.href ? (
                    <Typography
                      component={Link}
                      href={crumb.href}
                      sx={{
                        fontSize: '0.75rem',
                        color: '#64748B',
                        textDecoration: 'none',
                        '&:hover': { color: '#1E293B' },
                      }}
                    >
                      {crumb.label}
                    </Typography>
                  ) : (
                    <Typography
                      component="span"
                      sx={{
                        fontSize: '0.75rem',
                        color: '#334155',
                        fontWeight: 600,
                      }}
                    >
                      {crumb.label}
                    </Typography>
                  )}
                </React.Fragment>
              ))}
            </Box>
          )}

          <Typography
            variant="h6"
            sx={{
              fontSize: { xs: '1rem', sm: '1.1rem' },
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>
        </Box>

        <Box
          component="button"
          type="button"
          onClick={handleOpenMenu}
          sx={{
            ml: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            borderRadius: 999,
            px: 0.5,
            py: 0.3,
            cursor: 'pointer',
            border: 'none',
            backgroundColor: 'transparent',
            '&:hover': { backgroundColor: '#F8FAFC' },
          }}
          aria-label="Open user menu"
        >
          <Box sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#0F172A' }}>
              {resolvedName}
            </Typography>
            {resolvedEmail && (
              <Typography sx={{ fontSize: '0.75rem', color: '#64748B', lineHeight: 1.2 }}>
                {resolvedEmail}
              </Typography>
            )}
          </Box>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: '#0B1739',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            {initials}
          </Avatar>
        </Box>
      </Toolbar>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 220,
              borderRadius: 2,
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.14)',
            },
          },
        }}
      >
        <MenuItem onClick={() => handleNavigate('/settings')}>Settings</MenuItem>
        <MenuItem onClick={() => handleNavigate('/profile')}>User Information</MenuItem>
        <MenuItem onClick={handleLogout} sx={{ color: '#B91C1C', fontWeight: 600 }}>
          Logout
        </MenuItem>
      </Menu>
    </AppBar>
  );
};

export default Topbar;
