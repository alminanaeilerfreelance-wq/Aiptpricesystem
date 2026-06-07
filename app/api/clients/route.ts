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

const toClientPayload = (body: Record<string, unknown>) => ({
  name: String(body.name || '').trim(),
  email: toOptionalString(body.email),
  phone: toOptionalString(body.phone),
  type: normalizeClientType(body.type),
  address: toOptionalString(body.address),
  country: toOptionalString(body.country),
  companyName: toOptionalString(body.companyName),
  notes: toOptionalString(body.notes),
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

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { phone: { $regex: safeSearch, $options: 'i' } },
        { country: { $regex: safeSearch, $options: 'i' } },
        { continent: { $regex: safeSearch, $options: 'i' } },
        { city: { $regex: safeSearch, $options: 'i' } },
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { type: { $regex: safeSearch, $options: 'i' } },
        { registrationNumber: { $regex: safeSearch, $options: 'i' } },
        { taxId: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { notes: { $regex: safeSearch, $options: 'i' } },
        { status: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      Client.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ clients, total, page, limit, totalPages });
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
