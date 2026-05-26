import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OwnOffice from '@/models/OwnOffice';
import { getUserFromRequest } from '@/lib/auth';

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

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
        { country: { $regex: safeSearch, $options: 'i' } },
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { tax: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [ownOffices, total] = await Promise.all([
      OwnOffice.find(filter).sort({ country: 1, companyName: 1 }).skip(skip).limit(limit).lean(),
      OwnOffice.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({ ownOffices, total, page, limit, totalPages });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load own offices', err), { status: 500 });
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
    if (!body?.country || !String(body.country).trim()) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }
    if (!body?.companyName || !String(body.companyName).trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    const ownOffice = await OwnOffice.create(body);
    return NextResponse.json(ownOffice, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to create own office', err), { status: 500 });
  }
}
