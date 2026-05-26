import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OwnOffice from '@/models/OwnOffice';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid own office id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const ownOffice = await OwnOffice.findById(id).lean();
    if (!ownOffice || !ownOffice.isActive) {
      return NextResponse.json({ error: 'Own office not found' }, { status: 404 });
    }

    return NextResponse.json(ownOffice);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch own office', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid own office id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();

    if (body?.country !== undefined && !String(body.country).trim()) {
      return NextResponse.json({ error: 'Country cannot be empty' }, { status: 400 });
    }
    if (body?.companyName !== undefined && !String(body.companyName).trim()) {
      return NextResponse.json({ error: 'Company name cannot be empty' }, { status: 400 });
    }

    const ownOffice = await OwnOffice.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true, runValidators: true }
    );
    if (!ownOffice || !ownOffice.isActive) {
      return NextResponse.json({ error: 'Own office not found' }, { status: 404 });
    }

    return NextResponse.json(ownOffice);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to update own office', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid own office id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const ownOffice = await OwnOffice.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!ownOffice) return NextResponse.json({ error: 'Own office not found' }, { status: 404 });

    return NextResponse.json({ message: 'Own office deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete own office', err), { status: 500 });
  }
}
