import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';
import { getUserFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    await connectDB();

    const role = await Role.findById(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const normalized = normalizeRolePayload(role.toObject(), role.name);
    return NextResponse.json({ ...role.toObject(), ...normalized });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    const data = await req.json();

    if (data.name && !data.name.trim()) {
      return NextResponse.json({ error: 'Role name cannot be empty' }, { status: 400 });
    }

    const normalized = normalizeRolePayload(data, data.name);

    if (
      (data.permissions || data.modulePermissions) &&
      normalized.modulePermissions.length === 0
    ) {
      return NextResponse.json({ error: 'At least one permission is required' }, { status: 400 });
    }

    await connectDB();

    const role = await Role.findById(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Check if name is being changed and already exists
    if (data.name && data.name.trim() !== role.name) {
      const existing = await Role.findOne({ name: data.name });
      if (existing) {
        return NextResponse.json({ error: 'Role name already exists' }, { status: 409 });
      }
      role.name = data.name.trim();
    }

    if (data.description !== undefined) {
      role.description = data.description?.trim() || '';
    }

    if (data.permissions || data.modulePermissions) {
      role.permissions = normalized.permissions;
      role.modulePermissions = normalized.modulePermissions;
    }

    await role.save();

    return NextResponse.json(role);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
    }

    await connectDB();

    const role = await Role.findById(id);
    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    // Prevent deletion of default roles
    const defaultRoles = ['admin', 'manager', 'user'];
    if (defaultRoles.includes(role.name.toLowerCase())) {
      return NextResponse.json(
        { error: 'Cannot delete default roles' },
        { status: 400 }
      );
    }

    await Role.findByIdAndDelete(id);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
