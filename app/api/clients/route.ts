import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Client, { normalizeClientType } from '@/models/Client';
import { getUserFromRequest } from '@/lib/auth';

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

const toClientPayload = (body: Record<string, unknown>) => ({
  assignedId: toOptionalString(body.assignedId),
  name: String(body.name || '').trim(),
  email: toOptionalString(body.email),
  phone: toOptionalString(body.phone),
  country: toOptionalString(body.country),
  address: toOptionalString(body.address),
  companyName: toOptionalString(body.companyName),
  assignedServiceType: toOptionalServiceType(body.assignedServiceType),
  assignedIdCount: toOptionalNumber(body.assignedIdCount),
  type: normalizeClientType(body.type),
  notes: toOptionalString(body.notes),
  status: toOptionalStatus(body.status),
  isActive: toBoolean(body.isActive, true),
});

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
    const shouldReturnAll = searchParams.get('all') === 'true' || searchParams.get('all') === '1';

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { assignedId: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
        { country: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { assignedServiceType: { $regex: safeSearch, $options: 'i' } },
        { type: { $regex: safeSearch, $options: 'i' } },
        { notes: { $regex: safeSearch, $options: 'i' } },
        { status: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [clients, total] = await Promise.all([
      shouldReturnAll
        ? Client.find(filter).sort({ createdAt: -1 })
        : Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / (shouldReturnAll ? Math.max(total, 1) : limit));
    const effectivePage = shouldReturnAll ? 1 : page;
    const effectiveLimit = shouldReturnAll ? total : limit;

    return NextResponse.json({ clients, total, page: effectivePage, limit: effectiveLimit, totalPages });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load clients', err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const payload = toClientPayload(body || {});

    if (!payload.name) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }
    const client = await Client.create(payload);

    return NextResponse.json(client, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to create client', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const result = await Client.deleteMany({});

    return NextResponse.json({
      message: 'All clients deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete clients', err), { status: 500 });
  }
}
