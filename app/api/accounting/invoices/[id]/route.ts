import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import { getUserFromRequest } from '@/lib/auth';

const allowedStatuses = new Set(['Unpaid', 'Pending', 'Paid', 'Cancelled']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
    }
    const body = await req.json();
    const status = String(body.status || '');
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: 'Invalid invoice status.' }, { status: 400 });
    }
    if (status === 'Cancelled' && !String(body.cancellationReason || '').trim()) {
      return NextResponse.json({ error: 'Cancellation reason is required.' }, { status: 400 });
    }
    await connectDB();
    const invoice = await Invoice.findByIdAndUpdate(
      id,
      {
        status,
        updatedBy: user.userId,
        ...(status === 'Cancelled' ? { remarks: String(body.cancellationReason || '').trim() } : {}),
      },
      { new: true, runValidators: true }
    ).lean();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update invoice status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
