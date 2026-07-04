import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Bank from '@/models/Bank';
import { getUserFromRequest } from '@/lib/auth';
import { bankFormSchema } from '@/schemas/invoicing-schema';

const sortFields = new Set([
  'bankName',
  'bankHeader',
  'bankDescription',
  'accountName',
  'accountNumber',
  'iban',
  'swift',
  'currency',
  'status',
  'createdAt',
  'updatedAt',
]);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const bankPayload = (body: unknown) => {
  const parsed = bankFormSchema.parse({ ...(typeof body === 'object' && body ? body : {}), moduleType: 'Bank' });
  const { moduleType: _moduleType, ...data } = parsed;
  return data;
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const pageParam = Number(searchParams.get('page') || '1');
    const limitParam = Number(searchParams.get('limit') || '10');
    const search = (searchParams.get('search') || '').trim();
    const sortByParam = searchParams.get('sortBy') || 'bankName';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? -1 : 1;
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const sortBy = sortFields.has(sortByParam) ? sortByParam : 'bankName';
    const safeSearch = escapeRegex(search);
    const filter = search
      ? {
          $or: [
            { bankName: { $regex: safeSearch, $options: 'i' } },
            { bankHeader: { $regex: safeSearch, $options: 'i' } },
            { bankDescription: { $regex: safeSearch, $options: 'i' } },
            { accountName: { $regex: safeSearch, $options: 'i' } },
            { accountNumber: { $regex: safeSearch, $options: 'i' } },
            { iban: { $regex: safeSearch, $options: 'i' } },
            { swift: { $regex: safeSearch, $options: 'i' } },
            { currency: { $regex: safeSearch, $options: 'i' } },
            { status: { $regex: safeSearch, $options: 'i' } },
          ],
        }
      : {};

    const [banks, total] = await Promise.all([
      Bank.find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bank.countDocuments(filter),
    ]);

    return NextResponse.json({
      banks,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load banks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const data = bankPayload(await req.json());
    const bank = await Bank.create(data);
    return NextResponse.json(bank, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create bank';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
