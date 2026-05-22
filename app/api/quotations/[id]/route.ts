import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findById(params.id)
      .populate('clientId', 'name email phone country type address city')
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

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    // Recalculate financials if fees, numberOfClasses, or multiplier are being updated
    const existingDoc = await Quotation.findById(params.id);
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
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    )
      .populate('clientId', 'name email phone country type')
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
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const quotation = await Quotation.findByIdAndDelete(params.id);
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Quotation deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
