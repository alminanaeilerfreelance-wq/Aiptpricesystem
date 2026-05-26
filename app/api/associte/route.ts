import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Associte from '@/models/Associte';
import { getUserFromRequest } from '@/lib/auth';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VALID_STATUS = new Set(['Big', 'Small', 'New', 'Banned']);

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
    const status = (searchParams.get('status') || '').trim();
    const country = (searchParams.get('country') || '').trim();
    const continent = (searchParams.get('continent') || '').trim();
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    if (status && !VALID_STATUS.has(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (status) {
      filter.status = status;
    }
    if (country) {
      filter.country = country;
    }
    if (continent) {
      filter.continent = continent;
    }

    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { assignedId: { $regex: safeSearch, $options: 'i' } },
        { associteName: { $regex: safeSearch, $options: 'i' } },
        { country: { $regex: safeSearch, $options: 'i' } },
        { continent: { $regex: safeSearch, $options: 'i' } },
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { contact: { $regex: safeSearch, $options: 'i' } },
        { notes: { $regex: safeSearch, $options: 'i' } },
        { associteType: { $regex: safeSearch, $options: 'i' } },
        { status: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [assocites, total] = await Promise.all([
      Associte.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Associte.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({ assocites, total, page, limit, totalPages });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load assocites', err), { status: 500 });
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
    if (!body?.assignedId || !String(body.assignedId).trim()) {
      return NextResponse.json(
        { error: 'Assigned ID is required' },
        { status: 400 }
      );
    }
    if (!body?.associteName || !String(body.associteName).trim()) {
      return NextResponse.json(
        { error: 'Associte Name is required' },
        { status: 400 }
      );
    }
    if (body?.status && !VALID_STATUS.has(String(body.status))) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    const existing = await Associte.findOne({
      assignedId: String(body.assignedId).trim(),
      isActive: true,
    });
    if (existing) {
      return NextResponse.json({ error: 'Assigned ID already exists' }, { status: 409 });
    }

    const associte = await Associte.create(body);
    return NextResponse.json(associte, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to create associte', err), { status: 500 });
  }
}
