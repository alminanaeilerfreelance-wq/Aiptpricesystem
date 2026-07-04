import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';
import Client from '@/models/Client';
import Country from '@/models/Country';

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

interface NormalizedInvoiceItem {
  pricingRuleId?: unknown;
  countryId?: unknown;
  procedureId?: unknown;
  item: string;
  country: string;
  procedure: string;
  officialFee: number;
  attorneyFee: number;
  quantity: number;
  vatPercentage: number;
  vatAmount: number;
  total: number;
}

const invoiceTypeFromService = (service: { category?: unknown; name?: unknown } | null | undefined) => {
  const value = String(service?.category || service?.name || 'Others');
  if (/trademark/i.test(value)) return 'Trademark';
  if (/patent/i.test(value)) return 'Patent';
  if (/design/i.test(value)) return 'Design';
  if (/copyright/i.test(value)) return 'Copyright';
  return 'Others';
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sortableFields = new Set(['invoiceNumber', 'invoiceDate', 'status', 'total', 'grandTotal', 'createdAt']);

const serializeInvoice = async (invoice: any) => {
  const [client, country] = await Promise.all([
    invoice.clientId ? Client.findById(invoice.clientId).select('name companyName assignedId').lean() : null,
    invoice.countryId ? Country.findById(invoice.countryId).select('name abbreviation').lean() : null,
  ]);

  return {
    ...invoice,
    _id: String(invoice._id),
    id: String(invoice._id),
    clientId: invoice.clientId ? String(invoice.clientId) : '',
    serviceId: invoice.serviceId ? String(invoice.serviceId) : '',
    countryId: invoice.countryId ? String(invoice.countryId) : '',
    procedureId: invoice.procedureId ? String(invoice.procedureId) : '',
    bankId: invoice.bankId ? String(invoice.bankId) : '',
    applicationIds: Array.isArray(invoice.applicationIds) ? invoice.applicationIds.map((id: unknown) => String(id)) : [],
    clientName: String(client?.companyName || client?.name || 'Unknown Client'),
    countryName: country?.abbreviation ? `${country.name} (${country.abbreviation})` : String(country?.name || 'Unknown Country'),
    invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : '',
    dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString() : null,
    createdAt: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : '',
    updatedAt: invoice.updatedAt ? new Date(invoice.updatedAt).toISOString() : '',
  };
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || searchParams.get('pageSize') || 10), 1), 100);
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const invoiceType = (searchParams.get('invoiceType') || '').trim();
    const sortBy = sortableFields.has(searchParams.get('sortBy') || '') ? String(searchParams.get('sortBy')) : 'invoiceDate';
    const sortDirection = searchParams.get('sortDirection') === 'asc' ? 1 : -1;

    const filter: Record<string, unknown> = {
      ...(invoiceType && invoiceType !== 'All' ? { invoiceType } : {}),
      ...(status && status !== 'All' ? { status } : {}),
      ...(search
        ? {
            $or: [
              { invoiceNumber: { $regex: escapeRegex(search), $options: 'i' } },
              { subject: { $regex: escapeRegex(search), $options: 'i' } },
              { bankName: { $regex: escapeRegex(search), $options: 'i' } },
              { clientReference: { $regex: escapeRegex(search), $options: 'i' } },
              { method: { $regex: escapeRegex(search), $options: 'i' } },
              { projectName: { $regex: escapeRegex(search), $options: 'i' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      Invoice.find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Invoice.countDocuments(filter),
    ]);

    const invoices = await Promise.all(rows.map(serializeInvoice));
    return NextResponse.json({ invoices, total, page, pageSize: limit, totalPages: Math.ceil(total / limit) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load invoices';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const requiredIds = ['clientId', 'serviceId', 'countryId', 'procedureId'];
    for (const key of requiredIds) {
      if (!mongoose.Types.ObjectId.isValid(String(body[key] || ''))) {
        return NextResponse.json({ error: `${key} is required.` }, { status: 400 });
      }
    }

    if (body.status === 'Confirmed' && !mongoose.Types.ObjectId.isValid(String(body.bankId || ''))) {
      return NextResponse.json({ error: 'bankId is required.' }, { status: 400 });
    }

    if (!body.invoiceDate || !body.invoiceNumber) {
      return NextResponse.json({ error: 'Invoice date and invoice number are required.' }, { status: 400 });
    }

    const existing = await Invoice.findOne({ invoiceNumber: body.invoiceNumber }).lean();
    if (existing) {
      return NextResponse.json({ error: 'Invoice number must be unique.' }, { status: 409 });
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one invoice item is required.' }, { status: 400 });
    }

    if (!String(body.subject || '').trim()) {
      return NextResponse.json({ error: 'Subject is required.' }, { status: 400 });
    }

    if (!mongoose.Types.ObjectId.isValid(String(body.bankId || ''))) {
      return NextResponse.json({ error: 'Bank is required.' }, { status: 400 });
    }

    const vatPercentage = toNumber(body.vatPercentage);
    if (Boolean(body.vatable) && vatPercentage <= 0) {
      return NextResponse.json({ error: 'VAT percentage is required when invoice is vatable.' }, { status: 400 });
    }

    const service = await Service.findById(body.serviceId).lean();
    const normalizedItems: NormalizedInvoiceItem[] = items.map((item: Record<string, unknown>) => {
      const officialFee = toNumber(item.officialFee);
      const attorneyFee = toNumber(item.attorneyFee);
      const quantity = Math.max(toNumber(item.quantity, 1), 1);
      const vatPercentage = Math.min(toNumber(item.vatPercentage), 100);
      const vatAmount = toNumber(item.vatAmount);
      const total = toNumber(item.total);

      return {
        pricingRuleId: mongoose.Types.ObjectId.isValid(String(item.pricingRuleId || '')) ? item.pricingRuleId : undefined,
        countryId: mongoose.Types.ObjectId.isValid(String(item.countryId || '')) ? item.countryId : undefined,
        procedureId: mongoose.Types.ObjectId.isValid(String(item.procedureId || '')) ? item.procedureId : undefined,
        item: String(item.item || ''),
        country: String(item.country || ''),
        procedure: String(item.procedure || ''),
        officialFee,
        attorneyFee,
        quantity,
        vatPercentage,
        vatAmount,
        total,
      };
    });

    const subtotalOfficialFee = normalizedItems.reduce((sum: number, item) => sum + item.officialFee * item.quantity, 0);
    const subtotalAttorneyFee = normalizedItems.reduce((sum: number, item) => sum + item.attorneyFee * item.quantity, 0);
    const totalVat = normalizedItems.reduce((sum: number, item) => sum + item.vatAmount, 0);
    const grandTotal = normalizedItems.reduce((sum: number, item) => sum + item.total, 0);

    const invoice = await Invoice.create({
      clientId: body.clientId,
      serviceId: body.serviceId,
      countryId: body.countryId,
      procedureId: body.procedureId,
      invoiceType: invoiceTypeFromService(service),
      invoiceNumber: body.invoiceNumber,
      invoiceDate: new Date(body.invoiceDate),
      clientReference: String(body.clientReference || ''),
      toAddress: String(body.toAddress || ''),
      recipient: String(body.toAddress || ''),
      subject: String(body.subject || ''),
      referenceNumber: Array.isArray(body.applicationIds) ? body.applicationIds.join(',') : '',
      projectName: String(service?.name || service?.category || ''),
      method: String(body.method || ''),
      clientMaster: String(body.clientName || ''),
      applicationIds: Array.isArray(body.applicationIds) ? body.applicationIds : [],
      items: normalizedItems,
      bankId: mongoose.Types.ObjectId.isValid(String(body.bankId || '')) ? body.bankId : undefined,
      bankName: String(body.bankName || ''),
      currency: String(body.currency || 'US$'),
      vatable: Boolean(body.vatable),
      vatPercentage,
      subtotalOfficialFee,
      subtotalAttorneyFee,
      totalVat,
      grandTotal,
      amount: subtotalOfficialFee + subtotalAttorneyFee,
      vat: totalVat,
      discount: 0,
      total: grandTotal,
      status: body.status === 'Confirmed' ? 'Pending' : 'Draft',
      createdBy: user.userId,
      updatedBy: user.userId,
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
