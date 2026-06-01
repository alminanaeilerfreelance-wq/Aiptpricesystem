import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';
import { getUserFromRequest, JWTPayload } from '@/lib/auth';
import {
  flattenModulePermissions,
  hasPermission,
  normalizeModulePermissions,
  type ModulePermission,
  type Resource,
  type ResourceAction,
} from '@/lib/permissions';

export interface RoleAccess {
  modulePermissions: ModulePermission[];
  permissions: string[];
}

export async function getRoleAccess(roleName: string): Promise<RoleAccess> {
  await connectDB();
  const role = await Role.findOne({ name: roleName }).lean();
  const modulePermissions = normalizeModulePermissions(
    role?.modulePermissions as ModulePermission[] | undefined,
    role?.permissions as string[] | undefined,
    roleName
  );

  return {
    modulePermissions,
    permissions: flattenModulePermissions(modulePermissions),
  };
}

export async function buildUserAccessPayload<T extends { role: string }>(
  user: T
): Promise<T & RoleAccess> {
  const access = await getRoleAccess(user.role);
  return {
    ...user,
    ...access,
  };
}

export async function requirePermission(
  req: NextRequest,
  module: Resource,
  action: ResourceAction
): Promise<{ user: JWTPayload; error?: undefined } | { user: null; error: NextResponse }> {
  const user = getUserFromRequest(req);
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const access = await getRoleAccess(user.role);
  if (!hasPermission({ role: user.role, ...access }, module, action)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: `Forbidden: ${action} permission required for ${module}` },
        { status: 403 }
      ),
    };
  }

  return { user };
}
