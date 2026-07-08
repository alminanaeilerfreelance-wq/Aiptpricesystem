import { NextRequest, NextResponse } from 'next/server';
import { FilterQuery, Types } from 'mongoose';
import connectDB from '@/lib/mongodb';
import { getUserFromRequest } from '@/lib/auth';
import Bank from '@/models/Bank';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Invoice, { type IInvoice } from '@/models/Invoice';
import Payment, { type IPayment } from '@/models/Payment';
import { normalizeAccountingStatus } from '@/lib/accounting';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const flagFromCode = (code: string) => {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 2) return '';
  return normalized
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
};

const moneyAmount = (invoice: Partial<IInvoice>) => Number(invoice.grandTotal ?? invoice.total ?? invoice.amount ?? 0);

const buildDateRange = (fromDate?: string | null, toDate?: string | null) => {
  const range: { $gte?: Date; $lt?: Date } = {};
  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00.000`);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (toDate) {
    const to = new Date(`${toDate}T00:00:00.000`);
    if (!Number.isNaN(to.getTime())) {
      to.setDate(to.getDate() + 1);
      range.$lt = to;
    }
  }
  return Object.keys(range).length ? range : null;
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const clientId = String(searchParams.get('clientId') || '').trim();
    const search = String(searchParams.get('search') || '').trim();
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    if (!clientId || !Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({
        client: null,
        records: [],
        totals: { total: 0, unpaid: 0, paid: 0, cancelled: 0, invoiceCount: 0 },
      });
    }

    const invoiceFilter: FilterQuery<IInvoice> = { clientId: new Types.ObjectId(clientId) };
    const dateRange = buildDateRange(fromDate, toDate);
    if (dateRange) invoiceFilter.invoiceDate = dateRange;
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: 'i' };
      invoiceFilter.$or = [
        { invoiceNumber: regex },
        { subject: regex },
        { method: regex },
        { projectName: regex },
        { remarks: regex },
      ];
    }

    const invoices = await Invoice.find(invoiceFilter).sort({ invoiceDate: -1, createdAt: -1 }).limit(2000).lean<any[]>();
    const invoiceIds = invoices.map((invoice) => invoice._id);
    const countryIds = Array.from(new Set(invoices.map((invoice) => String(invoice.countryId || '')).filter(Boolean)));

    const [client, payments, countries] = await Promise.all([
      Client.findById(clientId).select('name email phone country companyName assignedId').lean(),
      invoiceIds.length
        ? Payment.find({ invoice: { $in: invoiceIds } }).sort({ datePayment: -1, createdAt: -1 }).lean<any[]>()
        : [],
      countryIds.length ? Country.find({ _id: { $in: countryIds } }).select('name abbreviation flagCode').lean() : [],
    ]);

    const bankIds = Array.from(new Set(payments.map((payment) => String(payment.bank || '')).filter(Boolean)));
    const banks = bankIds.length ? await Bank.find({ _id: { $in: bankIds } }).select('bankName').lean() : [];

    const countryMap = new Map(countries.map((country) => [String(country._id), country]));
    const bankMap = new Map(banks.map((bank) => [String(bank._id), bank]));
    const paymentsByInvoice = new Map<string, Array<IPayment & { _id: Types.ObjectId | string }>>();
    payments.forEach((payment) => {
      const key = String(payment.invoice);
      const current = paymentsByInvoice.get(key) || [];
      current.push(payment);
      paymentsByInvoice.set(key, current);
    });

    const records = invoices.map((invoice) => {
      const invoicePayments = paymentsByInvoice.get(String(invoice._id)) || [];
      const activePayment = invoicePayments.find((payment) => payment.status !== 'Cancelled');
      const latestPayment = activePayment || invoicePayments[0];
      const country = countryMap.get(String(invoice.countryId));
      const bank = latestPayment ? bankMap.get(String(latestPayment.bank)) : null;
      const invoiceStatus = normalizeAccountingStatus(invoice.status);
      const status = latestPayment ? latestPayment.status : invoiceStatus;
      const amount = moneyAmount(invoice);
      const flagCode = String(country?.flagCode || country?.abbreviation || '').toUpperCase();

      return {
        id: String(invoice._id),
        paymentRef: latestPayment?.paymentRef || '-',
        country: `${flagFromCode(flagCode) ? `${flagFromCode(flagCode)} ` : ''}${country?.name || invoice.items?.[0]?.country || 'Unknown Country'}`,
        countryId: String(invoice.countryId || ''),
        datePayment: latestPayment?.datePayment ? new Date(latestPayment.datePayment).toISOString() : '',
        invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : '',
        invoiceNumber: String(invoice.invoiceNumber || ''),
        amount,
        currency: String(invoice.currency || ''),
        bank: bank?.bankName || invoice.bankName || '-',
        status,
      };
    });

    const totals = records.reduce(
      (acc, record) => {
        acc.invoiceCount += 1;
        acc.total += record.amount;
        if (record.status === 'Paid') acc.paid += record.amount;
        if (record.status === 'Cancelled') acc.cancelled += record.amount;
        if (record.status === 'Unpaid') acc.unpaid += record.amount;
        return acc;
      },
      { total: 0, unpaid: 0, paid: 0, cancelled: 0, invoiceCount: 0 }
    );

    return NextResponse.json({
      client,
      records,
      totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load client invoices.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
