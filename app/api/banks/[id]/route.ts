import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Bank from '@/models/Bank';
import { getUserFromRequest } from '@/lib/auth';
import { bankFormSchema } from '@/schemas/invoicing-schema';

const statusValues = ['Active', 'Abandon', 'Cancel'] as const;

const bankPayload = (body: unknown) => {
  const parsed = bankFormSchema.parse({ ...(typeof body === 'object' && body ? body : {}), moduleType: 'Bank' });
  const { moduleType: _moduleType, ...data } = parsed;
  return data;
};

type BankRouteContext = { params: Promise<{ id: string }> };

const ensureId = (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid bank id' }, { status: 400 });
  }
  return null;
};

export async function GET(req: NextRequest, context: BankRouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const invalid = ensureId(id);
    if (invalid) return invalid;

    await connectDB();
    const bank = await Bank.findById(id).lean();
    if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    return NextResponse.json(bank);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load bank';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: BankRouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const invalid = ensureId(id);
    if (invalid) return invalid;

    const body = await req.json();
    const data =
      typeof body === 'object' && body && 'status' in body && Object.keys(body).length === 1
        ? { status: String((body as { status?: string }).status) }
        : bankPayload(body);

    if ('status' in data && !statusValues.includes(data.status as (typeof statusValues)[number])) {
      return NextResponse.json({ error: 'Invalid bank status' }, { status: 400 });
    }

    await connectDB();
    const bank = await Bank.findByIdAndUpdate(id, data, { new: true, runValidators: true }).lean();
    if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    return NextResponse.json(bank);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update bank';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, context: BankRouteContext) {
  return PATCH(req, context);
}

export async function DELETE(req: NextRequest, context: BankRouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const invalid = ensureId(id);
    if (invalid) return invalid;

    await connectDB();
    const bank = await Bank.findByIdAndUpdate(id, { status: 'Abandon' }, { new: true, runValidators: true }).lean();
    if (!bank) return NextResponse.json({ error: 'Bank not found' }, { status: 404 });
    return NextResponse.json(bank);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to abandon bank';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
