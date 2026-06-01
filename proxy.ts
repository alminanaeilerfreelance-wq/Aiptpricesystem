import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_MODULE_PERMISSIONS,
  flattenModulePermissions,
  hasPermission,
  type Resource,
  type ResourceAction,
} from '@/lib/permissions';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/seed-demo',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/admin/seed',
];

// Allowed origins for CORS (add more as needed for different environments)
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

function getToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return req.cookies.get('token')?.value ?? null;
}

function isTokenPresent(token: string | null): boolean {
  if (!token) return false;
  // Basic structure check: JWT has 3 parts separated by dots
  const parts = token.split('.');
  return parts.length === 3;
}

function decodeTokenPayload(token: string): { role?: string; permissions?: string[] } | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function getFallbackPermissions(role?: string): string[] {
  if (role !== 'admin' && role !== 'manager' && role !== 'user') return [];
  return flattenModulePermissions(DEFAULT_MODULE_PERMISSIONS[role]);
}

function getApiPermission(pathname: string, method: string): { module: Resource; action: ResourceAction } | null {
  const normalizedMethod = method.toUpperCase();
  let action: ResourceAction;

  if (normalizedMethod === 'GET') action = 'view';
  else if (normalizedMethod === 'POST') action = 'add';
  else if (normalizedMethod === 'PUT' || normalizedMethod === 'PATCH') action = 'update';
  else if (normalizedMethod === 'DELETE') action = 'delete';
  else return null;

  const mappings: Array<[string, Resource]> = [
    ['/api/quotations', 'quotations'],
    ['/api/client-quotations', 'client-quotations'],
    ['/api/associate-quotations', 'associate-quotations'],
    ['/api/inquires', 'inquiries'],
    ['/api/procedures', 'procedures'],
    ['/api/requirements', 'requirements'],
    ['/api/pricing-rules', 'pricing-rules'],
    ['/api/reports', 'reports'],
    ['/api/profit-loss', 'profit-loss-analysis'],
    ['/api/clients', 'clients'],
    ['/api/associte', 'associates'],
    ['/api/own-offices', 'own-offices'],
    ['/api/company-details', 'company-details'],
    ['/api/departments', 'departments'],
    ['/api/services', 'services'],
    ['/api/countries', 'countries'],
    ['/api/continents', 'continents'],
    ['/api/classification-of-fees', 'classification-of-fees'],
    ['/api/client-types', 'client-types'],
    ['/api/settings', 'settings'],
    ['/api/users', 'users'],
    ['/api/roles', 'roles'],
  ];

  const match = mappings.find(([prefix]) => pathname.startsWith(prefix));
  if (!match) return null;

  if (pathname.includes('/approve')) action = 'update';
  if (pathname.includes('/pdf')) action = 'view';
  if (pathname.includes('/send-email')) action = 'update';
  if (pathname.includes('/countries-in-use')) action = 'view';

  return { module: match[1], action };
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '3600',
    'Vary': 'Origin, Access-Control-Request-Headers',
  };
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const origin = req.headers.get('origin');

  if (!pathname.startsWith('/api/')) {
    // Page routes - allow public paths, redirect to login if no token present
    if (!PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
      const token = req.cookies.get('token')?.value;
      if (!isTokenPresent(token ?? null)) {
        return NextResponse.redirect(new URL('/login', req.url));
      }
    }

    return NextResponse.next();
  }

  const corsHeaders = getCorsHeaders(origin);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: corsHeaders });
  }

  // Handle public API paths (no auth required)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
    return response;
  }

  // Handle protected API paths
  const token = getToken(req);
  if (!isTokenPresent(token)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
  }

  const requiredPermission = getApiPermission(pathname, req.method);
  if (requiredPermission && token) {
    const payload = decodeTokenPayload(token);
    const permissions = payload?.permissions?.length
      ? payload.permissions
      : getFallbackPermissions(payload?.role);

    if (
      !hasPermission(
        { role: payload?.role, permissions },
        requiredPermission.module,
        requiredPermission.action
      )
    ) {
      return NextResponse.json(
        {
          error: `Forbidden: ${requiredPermission.action} permission required for ${requiredPermission.module}`,
        },
        { status: 403, headers: corsHeaders }
      );
    }
  }

  const response = NextResponse.next();
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|public/).*)'],
};
