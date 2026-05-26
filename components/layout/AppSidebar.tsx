'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Avatar,
  Box,
  Collapse,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useAuth } from '@/hooks/useAuth';
import { useLayoutShell } from './LayoutShellContext';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  isActive?: (pathname: string) => boolean;
}

export const APP_DRAWER_WIDTH = 280;

const IconBase = ({ children }: { children: React.ReactNode }) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    sx={{ width: 20, height: 20, strokeWidth: 1.8, flexShrink: 0 }}
    aria-hidden="true"
  >
    {children}
  </Box>
);

const DashboardIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </IconBase>
);

const PlusIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </IconBase>
);

const ListIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 8h6M9 16h4M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
  </IconBase>
);

const BriefcaseIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </IconBase>
);

const GlobeIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </IconBase>
);

const ClipboardIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </IconBase>
);

const UsersIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </IconBase>
);

const TagIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
  </IconBase>
);

const ChartBarIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </IconBase>
);

const CurrencyIcon = () => (
  <IconBase>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </IconBase>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <Box
    component="svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    sx={{
      width: 18,
      height: 18,
      transition: 'transform 0.2s ease',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
    }}
    aria-hidden="true"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </Box>
);

const mainNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <DashboardIcon />, isActive: (pathname) => pathname === '/dashboard' },
  { label: 'New Quotation', href: '/quotations/new', icon: <PlusIcon />, isActive: (pathname) => pathname === '/quotations/new' },
  {
    label: 'All Quotations',
    href: '/quotations',
    icon: <ListIcon />,
    isActive: (pathname) => pathname.startsWith('/quotations') && pathname !== '/quotations/new',
  },
  { label: 'Client Quotations', href: '/client-quotations', icon: <ListIcon /> },
  { label: 'Associate Quotations', href: '/associate-quotations', icon: <ListIcon /> },
  { label: 'Procedures', href: '/procedures', icon: <ClipboardIcon /> },
  { label: 'Requirements', href: '/requirements', icon: <TagIcon /> },
  { label: 'Pricing Rules', href: '/pricing-rules', icon: <TagIcon /> },
  { label: 'Quotations Report', href: '/reports/quotations', icon: <ChartBarIcon /> },
  { label: 'Profit/Loss Analysis', href: '/profit-loss-analysis', icon: <ChartBarIcon /> },
  { label: 'Revenue Report', href: '/reports/revenue', icon: <CurrencyIcon /> },
];

const masterDataItems: NavItem[] = [
  { label: 'Client', href: '/clients', icon: <UsersIcon /> },
  { label: 'Associte', href: '/associte', icon: <UsersIcon /> },
  { label: 'Own Offices', href: '/own-offices', icon: <BriefcaseIcon /> },
  { label: 'Department', href: '/departments', icon: <BriefcaseIcon /> },
  { label: 'Services', href: '/services', icon: <BriefcaseIcon /> },
  { label: 'Countries', href: '/countries', icon: <GlobeIcon /> },
  { label: 'Continents', href: '/continents', icon: <GlobeIcon /> },
  { label: 'Classifications of Fees', href: '/classification-of-fees', icon: <TagIcon /> },
  { label: 'Client Type', href: '/client-types', icon: <UsersIcon /> },
];

const secondaryNavItems: NavItem[] = [{ label: 'Users', href: '/users', icon: <UsersIcon /> }];

const itemButtonSx = {
  borderRadius: 2,
  px: 1.5,
  py: 1,
  color: 'rgba(255,255,255,0.72)',
  '& .MuiListItemIcon-root': {
    color: 'inherit',
    minWidth: 34,
  },
  '& .MuiListItemText-primary': {
    fontSize: '0.9rem',
    fontWeight: 500,
  },
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.10)',
    color: '#ffffff',
  },
};

const activeItemSx = {
  backgroundColor: '#2563EB',
  color: '#ffffff',
  '&:hover': {
    backgroundColor: '#1D4ED8',
  },
};

function SidebarSectionTitle({ title }: { title: string }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: 'rgba(148, 163, 184, 0.88)',
        letterSpacing: '0.1em',
        fontWeight: 700,
        px: 1.5,
        pt: 2,
        pb: 0.75,
        textTransform: 'uppercase',
      }}
    >
      {title}
    </Typography>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const masterHasActive = useMemo(
    () => masterDataItems.some((item) => pathname.startsWith(item.href)),
    [pathname]
  );

  const [masterDataOpen, setMasterDataOpen] = useState(masterHasActive);

  useEffect(() => {
    if (masterHasActive) {
      setMasterDataOpen(true);
    }
  }, [masterHasActive]);

  const isActive = (item: NavItem) => {
    if (item.isActive) return item.isActive(pathname);
    return pathname.startsWith(item.href);
  };

  const userName = user?.name ?? 'Admin User';
  const userEmail = user?.email ?? 'admin@iplawfirm.com';
  const initials = userName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0B1739' }}>
      <Box
        sx={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2.5,
          borderBottom: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            backgroundColor: '#2563EB',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: '0.95rem',
          }}
        >
          A
        </Box>
        <Typography
          variant="subtitle2"
          sx={{ color: '#fff', fontWeight: 700, letterSpacing: '0.04em' }}
        >
          AIP&T LAW FIRM
        </Typography>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
        <SidebarSectionTitle title="Main" />
        <List dense disablePadding>
          {mainNavItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={onNavigate}
              sx={{
                ...itemButtonSx,
                ...(isActive(item) ? activeItemSx : {}),
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>

        <SidebarSectionTitle title="Master Data" />
        <List dense disablePadding>
          <ListItemButton
            onClick={() => setMasterDataOpen((prev) => !prev)}
            sx={{
              ...itemButtonSx,
              ...(masterHasActive ? activeItemSx : {}),
            }}
          >
            <ListItemIcon>
              <BriefcaseIcon />
            </ListItemIcon>
            <ListItemText primary="Master Data" />
            <ChevronIcon open={masterDataOpen} />
          </ListItemButton>

          <Collapse in={masterDataOpen} timeout="auto" unmountOnExit>
            <List disablePadding dense sx={{ pt: 0.5 }}>
              {masterDataItems.map((item) => (
                <ListItemButton
                  key={item.href}
                  component={Link}
                  href={item.href}
                  onClick={onNavigate}
                  sx={{
                    ...itemButtonSx,
                    ml: 1,
                    pl: 2,
                    ...(isActive(item) ? activeItemSx : {}),
                  }}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              ))}
            </List>
          </Collapse>
        </List>

        <SidebarSectionTitle title="Administration" />
        <List dense disablePadding>
          {secondaryNavItems.map((item) => (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              onClick={onNavigate}
              sx={{
                ...itemButtonSx,
                ...(isActive(item) ? activeItemSx : {}),
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.10)' }} />
      <Box sx={{ px: 2, py: 1.75, display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Avatar sx={{ width: 34, height: 34, bgcolor: '#2563EB', fontSize: '0.85rem', fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 600 }} noWrap>
            {userName}
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(203,213,225,0.9)' }} noWrap>
            {userEmail}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export interface AppSidebarProps {}

const AppSidebar: React.FC<AppSidebarProps> = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)', { noSsr: true });
  const { desktopOpen, mobileOpen, closeMobileSidebar } = useLayoutShell();

  return (
    <>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobileSidebar}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          '& .MuiDrawer-paper': {
            width: APP_DRAWER_WIDTH,
            borderRight: 'none',
          },
        }}
      >
        <SidebarContent onNavigate={closeMobileSidebar} />
      </Drawer>

      <Drawer
        variant="persistent"
        open={desktopOpen}
        sx={{
          display: { xs: 'none', lg: 'block' },
          '& .MuiDrawer-paper': {
            width: APP_DRAWER_WIDTH,
            borderRight: 'none',
            boxSizing: 'border-box',
          },
        }}
      >
        <SidebarContent onNavigate={isDesktop ? () => undefined : closeMobileSidebar} />
      </Drawer>
    </>
  );
};

export default AppSidebar;
