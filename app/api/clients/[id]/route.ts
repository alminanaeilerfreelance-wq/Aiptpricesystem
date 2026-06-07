import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Client, { normalizeClientType } from '@/models/Client';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

const toOptionalString = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || undefined;
};

const textFields = ['email', 'phone', 'address', 'country', 'companyName', 'notes'] as const;

const hasOwn = (body: Record<string, unknown>, field: string) =>
  Object.prototype.hasOwnProperty.call(body, field);

const toClientUpdatePayload = (body: Record<string, unknown>) => {
  const payload: Record<string, unknown> = {};

  if (hasOwn(body, 'name')) {
    payload.name = String(body.name || '').trim();
  }

  for (const field of textFields) {
    if (hasOwn(body, field)) {
      payload[field] = toOptionalString(body[field]);
    }
  }

  if (hasOwn(body, 'type')) {
    payload.type = normalizeClientType(body.type);
  }

  return payload;
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const client = await Client.findById(id);
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch client', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const payload = toClientUpdatePayload(body || {});

    if (Object.prototype.hasOwnProperty.call(payload, 'name') && !payload.name) {
      return NextResponse.json({ error: 'Client name cannot be empty' }, { status: 400 });
    }
    const client = await Client.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to update client', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Soft delete: mark as inactive rather than removing from DB
    const client = await Client.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete client', err), { status: 500 });
  }
}
