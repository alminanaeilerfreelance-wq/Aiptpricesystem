import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { listAccountingPayments } from '@/lib/accounting';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const records = await listAccountingPayments({
      status: 'Paid',
      search: searchParams.get('search') || undefined,
      countryId: searchParams.get('countryId') || undefined,
      bankId: searchParams.get('bankId') || undefined,
      date: searchParams.get('date') || undefined,
    });
    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load paid payments.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
