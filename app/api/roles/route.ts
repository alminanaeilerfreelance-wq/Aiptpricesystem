import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';
import { getUserFromRequest } from '@/lib/auth';
import {
  flattenModulePermissions,
  normalizeModulePermissions,
  type ModulePermission,
} from '@/lib/permissions';

function normalizeRolePayload(data: any, roleName?: string) {
  const modulePermissions = normalizeModulePermissions(
    data.modulePermissions as ModulePermission[] | undefined,
    data.permissions as string[] | undefined,
    roleName || data.name
  );

  return {
    modulePermissions,
    permissions: flattenModulePermissions(modulePermissions),
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    const filter = search
      ? {
          $or: [
            { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
            { description: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          ],
        }
      : {};

    const [rolesRaw, total] = await Promise.all([
      Role.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
      Role.countDocuments(filter),
    ]);

    const roles = rolesRaw.map((role) => {
      const normalized = normalizeRolePayload(role, role.name);
      return { ...role, ...normalized };
    });

    return NextResponse.json({
      roles,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = await req.json();

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'Role name is required' }, { status: 400 });
    }

    const normalized = normalizeRolePayload(data);

    if (normalized.modulePermissions.length === 0) {
      return NextResponse.json({ error: 'At least one permission is required' }, { status: 400 });
    }

    await connectDB();

    // Check if role already exists
    const existing = await Role.findOne({ name: data.name });
    if (existing) {
      return NextResponse.json({ error: 'Role already exists' }, { status: 409 });
    }

    const role = new Role({
      name: data.name.trim(),
      description: data.description?.trim() || '',
      permissions: normalized.permissions,
      modulePermissions: normalized.modulePermissions,
    });

    await role.save();

    return NextResponse.json(role, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
