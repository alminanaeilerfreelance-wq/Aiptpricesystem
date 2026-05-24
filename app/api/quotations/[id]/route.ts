import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import '@/models/Requirement';
import '@/models/Country';
import '@/models/Client';
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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findById(id)
      .populate('clientId', 'name email phone country type address city')
      .populate({
        path: 'requirementIds',
        select: 'requirements country',
        populate: { path: 'country', select: 'name abbreviation' },
      })
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email');

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
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    if (body.requirementIds !== undefined) {
      body.requirementIds = parseRequirementIds(body.requirementIds);
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

    const quotation = await Quotation.findByIdAndUpdate(
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

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json(quotation);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
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
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
