'use server';

import { FilterQuery, Types } from 'mongoose';
import connectDB from '@/lib/mongodb';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Invoice, { type IInvoice } from '@/models/Invoice';
import {
  calculateInvoiceTotal,
  invoiceSchema,
  invoiceStatuses,
  invoiceTypes,
  type InvoiceFormInput,
  type InvoiceFormValues,
} from '@/schemas/invoice-schema';
import type { InvoiceListParams, InvoiceListResult, InvoiceRecord, InvoiceType } from '@/types/invoice';

type InvoiceLean = Omit<IInvoice, keyof Document> & {
  _id: Types.ObjectId | string;
  clientId: Types.ObjectId | string;
  countryId: Types.ObjectId | string;
};

const sortableFields = new Set([
  'invoiceNumber',
  'referenceNumber',
  'applicationName',
  'invoiceDate',
  'dueDate',
  'status',
  'amount',
  'total',
  'createdAt',
]);

function ensureKnownInvoiceType(invoiceType: string) {
  if (!invoiceTypes.includes(invoiceType as (typeof invoiceTypes)[number])) {
    throw new Error('Invalid invoice type.');
  }
}

function ensureKnownStatus(status?: string) {
  if (status && status !== 'All' && !invoiceStatuses.includes(status as (typeof invoiceStatuses)[number])) {
    throw new Error('Invalid invoice status.');
  }
}

function serializeInvoice(
  invoice: InvoiceLean,
  clientNames: Map<string, string>,
  countryNames: Map<string, string>
): InvoiceRecord {
  const id = String(invoice._id);
  const clientId = String(invoice.clientId);
  const countryId = String(invoice.countryId);

  return {
    id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceType: invoice.invoiceType,
    referenceNumber: invoice.referenceNumber,
    applicationNumber: invoice.applicationNumber,
    applicationName: invoice.applicationName,
    projectName: invoice.projectName,
    method: invoice.method,
    clientMaster: invoice.clientMaster,
    recipient: invoice.recipient,
    subject: invoice.subject,
    bankName: invoice.bankName,
    clientId,
    clientName: clientNames.get(clientId) || 'Unknown Client',
    countryId,
    countryName: countryNames.get(countryId) || 'Unknown Country',
    invoiceDate: invoice.invoiceDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    currency: invoice.currency,
    amount: invoice.amount,
    vat: invoice.vat,
    discount: invoice.discount,
    total: invoice.total,
    status: invoice.status,
    remarks: invoice.remarks,
    attachment: invoice.attachment,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
  };
}

async function loadLookupNames(invoices: InvoiceLean[]) {
  await connectDB();

  const clientIds = Array.from(new Set(invoices.map((invoice) => String(invoice.clientId)).filter(Boolean)));
  const countryIds = Array.from(new Set(invoices.map((invoice) => String(invoice.countryId)).filter(Boolean)));

  const [clients, countries] = await Promise.all([
    clientIds.length ? Client.find({ _id: { $in: clientIds } }).select('name').lean() : [],
    countryIds.length ? Country.find({ _id: { $in: countryIds } }).select('name abbreviation').lean() : [],
  ]);

  const clientNames = new Map(clients.map((client) => [String(client._id), String(client.name || '')]));
  const countryNames = new Map(
    countries.map((country) => [
      String(country._id),
      country.abbreviation ? `${country.name} (${country.abbreviation})` : String(country.name || ''),
    ])
  );

  return { clientNames, countryNames };
}

function buildData(input: InvoiceFormValues) {
  const total = calculateInvoiceTotal(input.amount, input.vat, input.discount);

  return {
    invoiceNumber: input.invoiceNumber,
    invoiceType: input.invoiceType,
    referenceNumber: input.referenceNumber,
    applicationNumber: input.applicationNumber,
    applicationName: input.applicationName,
    projectName: input.projectName,
    method: input.method,
    clientMaster: input.clientMaster,
    recipient: input.recipient,
    subject: input.subject,
    bankName: input.bankName,
    clientId: input.clientId,
    countryId: input.countryId,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    currency: input.currency,
    amount: input.amount,
    vat: input.vat,
    discount: input.discount,
    total,
    status: input.status,
    remarks: input.remarks,
    attachment: input.attachment,
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new Error('Invalid invoice id.');
  }
}

export async function listInvoices(params: InvoiceListParams): Promise<InvoiceListResult> {
  ensureKnownInvoiceType(params.invoiceType);
  ensureKnownStatus(params.status);
  await connectDB();

  const page = Math.max(Number(params.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(params.pageSize || 10), 1), 100);
  const search = params.search?.trim();
  const sortBy = sortableFields.has(params.sortBy || '') ? params.sortBy! : 'invoiceDate';
  const sortDirection = params.sortDirection === 'asc' ? 'asc' : 'desc';

  const filter: FilterQuery<IInvoice> = {
    invoiceType: params.invoiceType,
    ...(params.status && params.status !== 'All' ? { status: params.status } : {}),
    ...(search
      ? {
          OR: [
            { invoiceNumber: { $regex: escapeRegex(search), $options: 'i' } },
            { referenceNumber: { $regex: escapeRegex(search), $options: 'i' } },
            { applicationNumber: { $regex: escapeRegex(search), $options: 'i' } },
            { applicationName: { $regex: escapeRegex(search), $options: 'i' } },
            { currency: { $regex: escapeRegex(search), $options: 'i' } },
            { remarks: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {}),
  };

  const sort: Record<string, 1 | -1> = { [sortBy]: sortDirection === 'asc' ? 1 : -1 };

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<InvoiceLean[]>(),
    Invoice.countDocuments(filter),
  ]);

  const { clientNames, countryNames } = await loadLookupNames(invoices);

  return {
    invoices: invoices.map((invoice) => serializeInvoice(invoice, clientNames, countryNames)),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function getInvoice(id: string): Promise<InvoiceRecord | null> {
  ensureObjectId(id);
  await connectDB();

  const invoice = await Invoice.findById(id).lean<InvoiceLean | null>();
  if (!invoice) return null;

  const { clientNames, countryNames } = await loadLookupNames([invoice]);
  return serializeInvoice(invoice, clientNames, countryNames);
}

export async function createInvoice(input: InvoiceFormInput): Promise<InvoiceRecord> {
  const parsed = invoiceSchema.parse(input);
  await connectDB();

  const created = (await Invoice.create(buildData(parsed))).toObject() as InvoiceLean;
  const { clientNames, countryNames } = await loadLookupNames([created]);
  return serializeInvoice(created, clientNames, countryNames);
}

export async function generateInvoiceNumber(
  invoiceType: InvoiceType,
  clientId: string,
  countryId: string
): Promise<string> {
  ensureKnownInvoiceType(invoiceType);

  if (!Types.ObjectId.isValid(clientId) || !Types.ObjectId.isValid(countryId)) {
    throw new Error('Client and country are required to generate invoice number.');
  }

  await connectDB();

  const [client, country] = await Promise.all([
    Client.findById(clientId).select('assignedId').lean(),
    Country.findById(countryId).select('abbreviation').lean(),
  ]);

  if (!client) {
    throw new Error('Selected client was not found.');
  }

  if (!country) {
    throw new Error('Selected country was not found.');
  }

  const year = new Date().getFullYear();
  const assignedId = String(client.assignedId || 'NA').trim().toUpperCase() || 'NA';
  const countryCode = String(country.abbreviation || 'XX').trim().toUpperCase() || 'XX';
  const serviceCode = invoiceType.charAt(0).toUpperCase();

  const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`);
  const startOfNextYear = new Date(`${year + 1}-01-01T00:00:00.000Z`);
  const sequence = (await Invoice.countDocuments({
    invoiceType,
    invoiceDate: { $gte: startOfYear, $lt: startOfNextYear },
  })) + 1;
  const formattedSequence = String(sequence).padStart(4, '0');

  return `${serviceCode}-${year}-${formattedSequence}-${assignedId}-${countryCode}`;
}

export async function updateInvoice(id: string, input: InvoiceFormInput): Promise<InvoiceRecord> {
  ensureObjectId(id);
  const parsed = invoiceSchema.parse(input);
  await connectDB();

  const updated = await Invoice.findByIdAndUpdate(id, buildData(parsed), {
    new: true,
    runValidators: true,
  }).lean<InvoiceLean | null>();

  if (!updated) {
    throw new Error('Invoice not found.');
  }

  const { clientNames, countryNames } = await loadLookupNames([updated]);
  return serializeInvoice(updated, clientNames, countryNames);
}

export async function deleteInvoice(id: string): Promise<{ success: true }> {
  ensureObjectId(id);
  await connectDB();
  await Invoice.findByIdAndDelete(id);
  return { success: true };
}
