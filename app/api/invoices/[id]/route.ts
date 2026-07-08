import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Invoice from '@/models/Invoice';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';
import { generateInvoicePdfToken } from '@/lib/invoice-pdf-token';

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const invoiceTypeFromService = (service: { category?: unknown; name?: unknown } | null | undefined) => {
  const value = String(service?.category || service?.name || 'Others');
  if (/trademark/i.test(value)) return 'Trademark';
  if (/patent/i.test(value)) return 'Patent';
  if (/design/i.test(value)) return 'Design';
  if (/copyright/i.test(value)) return 'Copyright';
  return 'Others';
};

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

const normalizeItems = (items: unknown[], vatable: boolean, vatPercentage: number) =>
  items.map((itemValue) => {
    const item = itemValue as Record<string, unknown>;
    const officialFee = toNumber(item.officialFee);
    const attorneyFee = toNumber(item.attorneyFee);
    const quantity = Math.max(toNumber(item.quantity, 1), 1);
    const vatRate = vatable ? Math.min(Math.max(vatPercentage, 0), 100) : 0;
    const vatAmount = toNumber(item.vatAmount, attorneyFee * quantity * (vatRate / 100));
    const total = toNumber(item.total, officialFee * quantity + attorneyFee * quantity + vatAmount);

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
      vatPercentage: vatRate,
      vatAmount,
      total,
    };
  });

async function buildUpdatePayload(body: any, userId: string) {
  const requiredIds = ['clientId', 'serviceId', 'countryId', 'procedureId'];
  for (const key of requiredIds) {
    if (!mongoose.Types.ObjectId.isValid(String(body[key] || ''))) {
      throw new Error(`${key} is required.`);
    }
  }
  if (!mongoose.Types.ObjectId.isValid(String(body.bankId || ''))) throw new Error('Bank is required.');
  if (!String(body.subject || '').trim()) throw new Error('Subject is required.');
  if (!body.invoiceDate || !body.invoiceNumber) throw new Error('Invoice date and invoice number are required.');

  const vatPercentage = toNumber(body.vatPercentage);
  if (Boolean(body.vatable) && vatPercentage <= 0) throw new Error('VAT percentage is required when invoice is vatable.');

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) throw new Error('At least one invoice item is required.');

  const [service, client] = await Promise.all([
    Service.findById(body.serviceId).lean(),
    Client.findById(body.clientId).select('assignedId').lean(),
  ]);
  if (!String(client?.assignedId || '').trim()) throw new Error('Assigned ID is required on the client profile.');
  const normalizedItems = normalizeItems(items, Boolean(body.vatable), vatPercentage);
  const subtotalOfficialFee = normalizedItems.reduce((sum, item) => sum + item.officialFee * item.quantity, 0);
  const subtotalAttorneyFee = normalizedItems.reduce((sum, item) => sum + item.attorneyFee * item.quantity, 0);
  const totalVat = normalizedItems.reduce((sum, item) => sum + item.vatAmount, 0);
  const grandTotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);

  return {
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
    bankId: body.bankId,
    bankName: String(body.bankName || ''),
    currency: String(body.currency || 'USD'),
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
    status: body.status === 'Confirmed' ? 'Unpaid' : String(body.status || 'Draft'),
    updatedBy: userId,
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
    await connectDB();
    const invoice = await Invoice.findById(id).lean();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    return NextResponse.json({ invoice: await serializeInvoice(invoice) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load invoice';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ error: 'Invalid invoice id.' }, { status: 400 });
    await connectDB();
    const body = await req.json();
    const duplicate = await Invoice.findOne({ invoiceNumber: body.invoiceNumber, _id: { $ne: id } }).lean();
    if (duplicate) return NextResponse.json({ error: 'Invoice number must be unique.' }, { status: 409 });
    const payload = await buildUpdatePayload(body, user.userId);
    const existing = await Invoice.findById(id).select('pdfAccessToken').lean();
    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { ...payload, pdfAccessToken: existing?.pdfAccessToken || generateInvoicePdfToken(id) },
      { new: true, runValidators: true }
    ).lean();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found.' }, { status: 404 });
    return NextResponse.json({ invoice: await serializeInvoice(invoice) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update invoice';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
