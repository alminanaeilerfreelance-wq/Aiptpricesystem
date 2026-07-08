import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { listAccountingInvoices } from '@/lib/accounting';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const records = await listAccountingInvoices({
      search: searchParams.get('search') || undefined,
      countryId: searchParams.get('countryId') || undefined,
      date: searchParams.get('date') || undefined,
      excludeActivePayment: searchParams.get('excludeActivePayment') !== '0',
    });
    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load invoice lookup.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
