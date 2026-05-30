import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Role from '@/models/Role';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const roles = await Role.find().lean();
    const total = roles.length;

    return NextResponse.json({
      roles,
      total,
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

    if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
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
      permissions: data.permissions,
    });

    await role.save();

    return NextResponse.json(role, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
