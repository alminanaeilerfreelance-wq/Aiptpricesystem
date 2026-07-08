import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { updateAccountingPaymentStatus } from '@/lib/accounting';
import { getUserFromRequest } from '@/lib/auth';
import type { PaymentStatus } from '@/models/Payment';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    const payment = await updateAccountingPaymentStatus(
      id,
      String(body.status || '') as PaymentStatus,
      body.cancellationReason
    );
    return NextResponse.json({ payment });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update payment.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
