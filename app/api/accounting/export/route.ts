import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { listAccountingInvoices, listAccountingPayments } from '@/lib/accounting';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get('kind') === 'payments' ? 'payments' : 'invoices';
    const records =
      kind === 'payments'
        ? await listAccountingPayments({
            status: searchParams.get('status') || undefined,
            search: searchParams.get('search') || undefined,
            countryId: searchParams.get('countryId') || undefined,
            bankId: searchParams.get('bankId') || undefined,
            date: searchParams.get('date') || undefined,
          })
        : await listAccountingInvoices({
            status: searchParams.get('status') || undefined,
            search: searchParams.get('search') || undefined,
            countryId: searchParams.get('countryId') || undefined,
            date: searchParams.get('date') || undefined,
            todayOnly: searchParams.get('todayOnly') === '1',
          });
    return NextResponse.json({ records });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to export accounting records.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
