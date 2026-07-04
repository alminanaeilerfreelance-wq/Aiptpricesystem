import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import ReferenceNumber from '@/models/ReferenceNumber';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const STATUSES = new Set(['Available', 'Reserved', 'Used', 'Cancelled']);

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid reference number id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const body = await req.json();
    const status = String(body?.status || '').trim();
    if (status && !STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const payload: Record<string, any> = {};
    if (status) payload.status = status;
    if (body?.usedBy !== undefined) {
      const usedBy = String(body.usedBy || '').trim();
      payload.usedBy = mongoose.Types.ObjectId.isValid(usedBy) ? new mongoose.Types.ObjectId(usedBy) : undefined;
    }
    if (body?.usedDate !== undefined) {
      payload.usedDate = body.usedDate ? new Date(body.usedDate) : undefined;
    }

    if (payload.status === 'Used' && !payload.usedDate) payload.usedDate = new Date();
    if (payload.status && payload.status !== 'Used') payload.usedDate = undefined;

    const existing = await ReferenceNumber.findById(id).lean();
    if (!existing) {
      return NextResponse.json({ error: 'Reference number not found' }, { status: 404 });
    }
    if (payload.usedBy && existing.usedBy && String(existing.usedBy) !== String(payload.usedBy)) {
      return NextResponse.json({ error: 'Reference is already assigned to another client' }, { status: 409 });
    }

    const referenceNumber = await ReferenceNumber.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true, runValidators: true }
    );

    if (!referenceNumber) {
      return NextResponse.json({ error: 'Reference number not found' }, { status: 404 });
    }

    return NextResponse.json(referenceNumber);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update reference number';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid reference number id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access is required to delete reference numbers' }, { status: 403 });
    }

    await connectDB();

    const deleted = await ReferenceNumber.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Reference number not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Reference number deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete reference number';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
