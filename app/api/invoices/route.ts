import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Invoice from '@/models/Invoice';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';

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
      invoiceType: service?.category || 'Trademark',
      invoiceNumber: body.invoiceNumber,
      invoiceDate: new Date(body.invoiceDate),
      clientReference: String(body.clientReference || ''),
      toAddress: String(body.toAddress || ''),
      recipient: String(body.toAddress || ''),
      subject: String(body.subject || ''),
      applicationIds: Array.isArray(body.applicationIds) ? body.applicationIds : [],
      items: normalizedItems,
      bankId: mongoose.Types.ObjectId.isValid(String(body.bankId || '')) ? body.bankId : undefined,
      bankName: String(body.bankName || ''),
      currency: String(body.currency || 'US$'),
      vatable: Boolean(body.vatable),
      vatPercentage: toNumber(body.vatPercentage),
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
