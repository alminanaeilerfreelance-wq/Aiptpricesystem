import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { createAccountingPayment, listAccountingPayments } from '@/lib/accounting';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const records = await listAccountingPayments({
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      countryId: searchParams.get('countryId') || undefined,
      bankId: searchParams.get('bankId') || undefined,
      date: searchParams.get('date') || undefined,
    });
    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const body = await req.json();
    const payment = await createAccountingPayment({
      invoiceId: String(body.invoiceId || ''),
      bankId: String(body.bankId || ''),
      datePayment: body.datePayment,
      status: body.status,
      userId: user.userId,
    });
    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create payment.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
