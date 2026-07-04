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

const CLIENT_STATUS_VALUES = new Set(['Big', 'Small', 'New', 'Banned']);
const CLIENT_SERVICE_TYPE_VALUES = new Set(['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation']);

const toOptionalStatus = (value: unknown) => {
  const text = String(value ?? '').trim();
  return CLIENT_STATUS_VALUES.has(text) ? text : undefined;
};

const toBoolean = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'active', '1'].includes(normalized)) return true;
    if (['false', 'no', 'inactive', '0'].includes(normalized)) return false;
  }
  return fallback;
};

const toOptionalServiceType = (value: unknown) => {
  const text = String(value ?? '').trim();
  return CLIENT_SERVICE_TYPE_VALUES.has(text) ? text : undefined;
};

const toOptionalNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return undefined;
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }
  return undefined;
};

const textFields = ['assignedId', 'email', 'phone', 'country', 'address', 'companyName', 'notes'] as const;

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

  if (hasOwn(body, 'assignedServiceType')) {
    payload.assignedServiceType = toOptionalServiceType(body.assignedServiceType);
  }

  if (hasOwn(body, 'assignedIdCount')) {
    payload.assignedIdCount = toOptionalNumber(body.assignedIdCount);
  }

  if (hasOwn(body, 'type')) {
    payload.type = normalizeClientType(body.type);
  }

  if (hasOwn(body, 'status')) {
    payload.status = toOptionalStatus(body.status);
  }

  if (hasOwn(body, 'isActive')) {
    payload.isActive = toBoolean(body.isActive);
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

    const client = await Client.findByIdAndDelete(id);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete client', err), { status: 500 });
  }
}
