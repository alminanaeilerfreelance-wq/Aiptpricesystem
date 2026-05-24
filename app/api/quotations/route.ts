import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import '@/models/Requirement';
import '@/models/Country';
import '@/models/Client';
import '@/models/User';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const parseRequirementIds = (raw: unknown): mongoose.Types.ObjectId[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((id) => (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id) ? id : null))
    .filter((id): id is string => Boolean(id))
    .map((id) => new mongoose.Types.ObjectId(id));
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const service = searchParams.get('service');
    const country = searchParams.get('country');
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {};

    if (status) {
      filter.status = status;
    }

    if (service) {
      filter.service = service;
    }

    if (country) {
      filter.country = country;
    }

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      const safeSearch = escapeRegex(normalizedSearch);
      filter.$or = [
        { quotationNo: { $regex: safeSearch, $options: 'i' } },
        { clientName: { $regex: safeSearch, $options: 'i' } },
        { clientEmail: { $regex: safeSearch, $options: 'i' } },
        { clientType: { $regex: safeSearch, $options: 'i' } },
        { service: { $regex: safeSearch, $options: 'i' } },
        { country: { $regex: safeSearch, $options: 'i' } },
        { procedure: { $regex: safeSearch, $options: 'i' } },
        { notes: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .populate('clientId', 'name email phone country type')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Quotation.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ quotations, total, page, limit, totalPages });
  } catch (err: unknown) {
    console.error('GET /api/quotations error:', err);
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

    await connectDB();

    const body = await req.json();

    const {
      fees,
      numberOfClasses = 1,
      multiplier = 1,
      requirementIds,
      ...rest
    } = body;

    const governmentFee = Number(fees?.governmentFee ?? 0);
    const serviceFee = Number(fees?.serviceFee ?? 0);
    const classFee = Number(fees?.classFee ?? 0);
    const procedureFee = Number(fees?.procedureFee ?? 0);

    const subtotal =
      governmentFee + serviceFee + classFee * Number(numberOfClasses) + procedureFee;
    const total = subtotal * Number(multiplier);

    const quotation = await Quotation.create({
      ...rest,
      requirementIds: parseRequirementIds(requirementIds),
      fees: { governmentFee, serviceFee, classFee, procedureFee },
      numberOfClasses: Number(numberOfClasses),
      multiplier: Number(multiplier),
      subtotal,
      total,
      createdBy: user.userId,
    });

    const populated = await quotation.populate([
      { path: 'clientId', select: 'name email phone country type' },
      {
        path: 'requirementIds',
        select: 'requirements country',
        populate: { path: 'country', select: 'name abbreviation' },
      },
      { path: 'createdBy', select: 'name email' },
    ]);

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/quotations error:', err);
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
