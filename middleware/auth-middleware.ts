import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export function requireAuth(req: NextRequest): { user: ReturnType<typeof getUserFromRequest>; error?: NextResponse } {
  const user = getUserFromRequest(req);
  if (!user) {
    return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { user };
}

export function requireRole(req: NextRequest, roles: string[]): { user: ReturnType<typeof getUserFromRequest>; error?: NextResponse } {
  const { user, error } = requireAuth(req);
  if (error || !user) return { user: null, error };
  if (!roles.includes(user.role)) {
    return { user: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}
