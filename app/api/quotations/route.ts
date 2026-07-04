import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import '@/models/Requirement';
import '@/models/Country';
import '@/models/Client';
import '@/models/Associte';
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

const hasInvalidRequirementIds = (raw: unknown): boolean => {
  if (!Array.isArray(raw)) return false;
  return raw.some((id) => typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id));
};

const VALID_SERVICES = new Set(['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation']);

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
        { inquiriesProject: { $regex: safeSearch, $options: 'i' } },
        { service: { $regex: safeSearch, $options: 'i' } },
        { country: { $regex: safeSearch, $options: 'i' } },
        { procedure: { $regex: safeSearch, $options: 'i' } },
        { notes: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const total = await Quotation.countDocuments(filter);

    let quotations;
    try {
      quotations = await Quotation.find(filter)
        .populate('clientId', 'name email phone country type')
        .populate({
          path: 'associteId',
          select: 'associteName email associteType contact address notes',
          strictPopulate: false,
        })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (populateError) {
      console.error('GET /api/quotations populate fallback:', populateError);
      quotations = await Quotation.find(filter)
        .populate('clientId', 'name email phone country type')
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ quotations, total, page, limit, totalPages });
  } catch (err: unknown) {
    console.error('GET /api/quotations error:', err);
    return NextResponse.json(toErrorPayload('Failed to load quotations', err), { status: 500 });
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

    if (!rest.clientName || !String(rest.clientName).trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }
    if (!rest.service || !String(rest.service).trim()) {
      return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    }
    if (!VALID_SERVICES.has(String(rest.service))) {
      return NextResponse.json({ error: 'Invalid service value' }, { status: 400 });
    }
    if (!rest.procedure || !String(rest.procedure).trim()) {
      return NextResponse.json({ error: 'Procedure is required' }, { status: 400 });
    }
    if (!rest.country || !String(rest.country).trim()) {
      return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    }

    const normalizedNumberOfClasses = Number(numberOfClasses);
    if (!Number.isFinite(normalizedNumberOfClasses) || normalizedNumberOfClasses < 1) {
      return NextResponse.json({ error: 'numberOfClasses must be a number greater than 0' }, { status: 400 });
    }

    const normalizedMultiplier = Number(multiplier);
    if (!Number.isFinite(normalizedMultiplier) || normalizedMultiplier <= 0) {
      return NextResponse.json({ error: 'multiplier must be a number greater than 0' }, { status: 400 });
    }

    if (requirementIds !== undefined && hasInvalidRequirementIds(requirementIds)) {
      return NextResponse.json({ error: 'Invalid requirementIds payload' }, { status: 400 });
    }

    if (typeof rest.associteId === 'string' && mongoose.Types.ObjectId.isValid(rest.associteId)) {
      rest.associteId = new mongoose.Types.ObjectId(rest.associteId);
    } else if (rest.associteId === undefined || rest.associteId === null || rest.associteId === '') {
      delete rest.associteId;
    } else if (typeof rest.associteId === 'string') {
      return NextResponse.json({ error: 'Invalid associteId' }, { status: 400 });
    } else if (!rest.associteId) {
      delete rest.associteId;
    }

    const governmentFee = Number(fees?.governmentFee ?? 0);
    const serviceFee = Number(fees?.serviceFee ?? 0);
    const classFee = Number(fees?.classFee ?? 0);
    const procedureFee = Number(fees?.procedureFee ?? 0);

    if (![governmentFee, serviceFee, classFee, procedureFee].every((value) => Number.isFinite(value) && value >= 0)) {
      return NextResponse.json({ error: 'Fee values must be non-negative numbers' }, { status: 400 });
    }

    const subtotal =
      governmentFee + serviceFee + classFee * normalizedNumberOfClasses + procedureFee;
    const total = subtotal * normalizedMultiplier;

    const quotation = await Quotation.create({
      ...rest,
      requirementIds: parseRequirementIds(requirementIds),
      fees: { governmentFee, serviceFee, classFee, procedureFee },
      numberOfClasses: normalizedNumberOfClasses,
      multiplier: normalizedMultiplier,
      subtotal,
      total,
      createdBy: user.userId,
    });

    const populated = await quotation.populate([
      { path: 'clientId', select: 'name email phone country type' },
      {
        path: 'associteId',
        select: 'associteName email associteType contact address notes',
        strictPopulate: false,
      },
      {
        path: 'requirementIds',
        select: 'requirements country',
        populate: { path: 'country', select: 'name abbreviation' },
      },
      { path: 'createdBy', select: 'name email' },
    ]);

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid quotation payload', err), { status: 400 });
    }
    console.error('POST /api/quotations error:', err);
    return NextResponse.json(toErrorPayload('Failed to create quotation', err), { status: 500 });
  }
}
