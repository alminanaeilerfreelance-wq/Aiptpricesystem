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
import { generateQuotationPdfToken } from '@/lib/quotation-pdf-token';

interface RouteContext {
  params: Promise<{ id: string }>;
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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    let quotation;
    try {
      quotation = await Quotation.findById(id)
        .populate('clientId', 'name email phone country type address city')
        .populate({
          path: 'associteId',
          select: 'associteName email associteType contact address notes',
          strictPopulate: false,
        })
        .populate({
          path: 'requirementIds',
          select: 'requirements country',
          populate: { path: 'country', select: 'name abbreviation' },
        })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');
    } catch (populateError) {
      console.error('GET /api/quotations/[id] populate fallback:', populateError);
      quotation = await Quotation.findById(id)
        .populate('clientId', 'name email phone country type address city')
        .populate({
          path: 'requirementIds',
          select: 'requirements country',
          populate: { path: 'country', select: 'name abbreviation' },
        })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');
    }

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const quotationObject = quotation.toObject();
    const pdfAccessToken = generateQuotationPdfToken(id);

    return NextResponse.json({
      ...quotationObject,
      pdfAccessToken,
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch quotation', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    if (body.requirementIds !== undefined) {
      if (hasInvalidRequirementIds(body.requirementIds)) {
        return NextResponse.json({ error: 'Invalid requirementIds payload' }, { status: 400 });
      }
      body.requirementIds = parseRequirementIds(body.requirementIds);
    }

    if (body.service !== undefined) {
      if (!String(body.service).trim() || !VALID_SERVICES.has(String(body.service))) {
        return NextResponse.json({ error: 'Invalid service value' }, { status: 400 });
      }
    }

    if (body.clientName !== undefined && !String(body.clientName).trim()) {
      return NextResponse.json({ error: 'Client name cannot be empty' }, { status: 400 });
    }
    if (body.procedure !== undefined && !String(body.procedure).trim()) {
      return NextResponse.json({ error: 'Procedure cannot be empty' }, { status: 400 });
    }
    if (body.country !== undefined && !String(body.country).trim()) {
      return NextResponse.json({ error: 'Country cannot be empty' }, { status: 400 });
    }

    if (body.numberOfClasses !== undefined) {
      const numberOfClasses = Number(body.numberOfClasses);
      if (!Number.isFinite(numberOfClasses) || numberOfClasses < 1) {
        return NextResponse.json({ error: 'numberOfClasses must be a number greater than 0' }, { status: 400 });
      }
      body.numberOfClasses = numberOfClasses;
    }

    if (body.multiplier !== undefined) {
      const multiplier = Number(body.multiplier);
      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        return NextResponse.json({ error: 'multiplier must be a number greater than 0' }, { status: 400 });
      }
      body.multiplier = multiplier;
    }

    if (body.associteId !== undefined && body.associteId !== null && body.associteId !== '') {
      if (typeof body.associteId !== 'string' || !mongoose.Types.ObjectId.isValid(body.associteId)) {
        return NextResponse.json({ error: 'Invalid associteId' }, { status: 400 });
      }
      body.associteId = new mongoose.Types.ObjectId(body.associteId);
    }

    if (body.fees !== undefined) {
      const governmentFee = Number(body.fees?.governmentFee ?? 0);
      const serviceFee = Number(body.fees?.serviceFee ?? 0);
      const classFee = Number(body.fees?.classFee ?? 0);
      const procedureFee = Number(body.fees?.procedureFee ?? 0);
      if (![governmentFee, serviceFee, classFee, procedureFee].every((value) => Number.isFinite(value) && value >= 0)) {
        return NextResponse.json({ error: 'Fee values must be non-negative numbers' }, { status: 400 });
      }
      body.fees = { governmentFee, serviceFee, classFee, procedureFee };
    }

    // Recalculate financials if fees, numberOfClasses, or multiplier are being updated
    const existingDoc = await Quotation.findById(id);
    if (!existingDoc) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const hasFeeChange =
      body.fees !== undefined ||
      body.numberOfClasses !== undefined ||
      body.multiplier !== undefined;

    if (hasFeeChange) {
      const fees = body.fees ?? existingDoc.fees;
      const numberOfClasses = body.numberOfClasses ?? existingDoc.numberOfClasses;
      const multiplier = body.multiplier ?? existingDoc.multiplier;

      const governmentFee = Number(fees?.governmentFee ?? 0);
      const serviceFee = Number(fees?.serviceFee ?? 0);
      const classFee = Number(fees?.classFee ?? 0);
      const procedureFee = Number(fees?.procedureFee ?? 0);

      body.fees = { governmentFee, serviceFee, classFee, procedureFee };
      body.subtotal =
        governmentFee + serviceFee + classFee * Number(numberOfClasses) + procedureFee;
      body.total = body.subtotal * Number(multiplier);
    }

    let quotation;
    try {
      quotation = await Quotation.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true, runValidators: true }
      )
        .populate('clientId', 'name email phone country type')
        .populate({
          path: 'associteId',
          select: 'associteName email associteType contact address notes',
          strictPopulate: false,
        })
        .populate({
          path: 'requirementIds',
          select: 'requirements country',
          populate: { path: 'country', select: 'name abbreviation' },
        })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');
    } catch (populateError) {
      console.error('PATCH /api/quotations/[id] populate fallback:', populateError);
      quotation = await Quotation.findByIdAndUpdate(
        id,
        { $set: body },
        { new: true, runValidators: true }
      )
        .populate('clientId', 'name email phone country type')
        .populate({
          path: 'requirementIds',
          select: 'requirements country',
          populate: { path: 'country', select: 'name abbreviation' },
        })
        .populate('createdBy', 'name email')
        .populate('approvedBy', 'name email');
    }

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to update quotation', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findByIdAndDelete(id);
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Quotation deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete quotation', err), { status: 500 });
  }
}
