import mongoose, { FilterQuery, Types } from 'mongoose';
import Bank from '@/models/Bank';
import Country from '@/models/Country';
import Invoice, { type IInvoice } from '@/models/Invoice';
import Payment, { paymentStatuses, type IPayment, type PaymentStatus } from '@/models/Payment';
import User from '@/models/User';

export type AccountingInvoiceStatus = 'Unpaid' | 'Pending' | 'Paid' | 'Cancelled';

export interface AccountingInvoiceRecord {
  id: string;
  countryId: string;
  countryName: string;
  countryAbbreviation: string;
  countryFlag: string;
  invoiceNumber: string;
  procedure: string;
  amount: number;
  currency: string;
  status: AccountingInvoiceStatus | string;
  reason: string;
  createdDate: string;
  invoiceDate: string;
}

export interface AccountingPaymentRecord {
  id: string;
  paymentRef: string;
  countryId: string;
  countryName: string;
  countryAbbreviation: string;
  countryFlag: string;
  datePayment: string;
  invoiceId: string;
  invoiceNumber: string;
  procedure: string;
  amount: number;
  bankId: string;
  bankName: string;
  userId: string;
  userName: string;
  status: PaymentStatus;
  cancellationReason: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingListParams {
  search?: string;
  status?: string;
  countryId?: string;
  bankId?: string;
  date?: string;
  todayOnly?: boolean;
  excludeActivePayment?: boolean;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const normalizeAccountingStatus = (value: unknown): AccountingInvoiceStatus | string => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'paid') return 'Paid';
  if (raw === 'pending') return 'Pending';
  if (raw === 'cancelled' || raw === 'canceled') return 'Cancelled';
  if (raw === 'unpaid' || raw === 'draft') return 'Unpaid';
  return String(value || 'Unpaid');
};

const moneyAmount = (invoice: Partial<IInvoice>) => Number(invoice.grandTotal ?? invoice.total ?? invoice.amount ?? 0);

const firstProcedure = (invoice: Partial<IInvoice>) => {
  const invoiceCountryId = String(invoice.countryId || '');
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const matchingItems = invoiceCountryId
    ? items.filter((item) => !item.countryId || String(item.countryId) === invoiceCountryId)
    : items;
  const sourceItems = matchingItems.length ? matchingItems : items;
  const fromItems = sourceItems.map((item) => item.procedure || item.item).filter(Boolean).join(', ');
  return String(fromItems || invoice.method || invoice.projectName || invoice.invoiceType || '-');
};

const flagFromCode = (code: string) => {
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 2) return '';
  return normalized
    .split('')
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join('');
};

const dateRange = (value: string) => {
  const date = new Date(`${value}T00:00:00.000`);
  if (Number.isNaN(date.getTime())) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return { $gte: date, $lt: next };
};

export async function serializeAccountingInvoices(invoices: Array<IInvoice & { _id: Types.ObjectId | string }>) {
  const countryIds = Array.from(new Set(invoices.map((invoice) => String(invoice.countryId || '')).filter(Boolean)));
  const countries = countryIds.length
    ? await Country.find({ _id: { $in: countryIds } }).select('name abbreviation flagCode').lean()
    : [];
  const countryMap = new Map(countries.map((country) => [String(country._id), country]));

  return invoices.map((invoice) => {
    const country = countryMap.get(String(invoice.countryId));
    const flagCode = String(country?.flagCode || country?.abbreviation || '').toUpperCase();
    return {
      id: String(invoice._id),
      countryId: String(invoice.countryId || ''),
      countryName: String(country?.name || invoice.items?.[0]?.country || 'Unknown Country'),
      countryAbbreviation: String(country?.abbreviation || ''),
      countryFlag: flagFromCode(flagCode),
      invoiceNumber: String(invoice.invoiceNumber || ''),
      procedure: firstProcedure(invoice),
      amount: moneyAmount(invoice),
      currency: String(invoice.currency || ''),
      status: normalizeAccountingStatus(invoice.status),
      reason: String(invoice.remarks || ''),
      createdDate: invoice.createdAt ? new Date(invoice.createdAt).toISOString() : '',
      invoiceDate: invoice.invoiceDate ? new Date(invoice.invoiceDate).toISOString() : '',
    };
  });
}

export async function listAccountingInvoices(params: AccountingListParams = {}) {
  const search = params.search?.trim();
  const filter: FilterQuery<IInvoice> = {};
  if (params.status === 'Cancelled') filter.status = 'Cancelled';
  if (params.status === 'Unpaid') filter.status = { $in: ['Unpaid', 'Draft'] };
  if (params.countryId && Types.ObjectId.isValid(params.countryId)) filter.countryId = params.countryId;
  if (params.todayOnly) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    filter.createdAt = { $gte: start, $lt: end };
  }
  if (params.date) {
    const range = dateRange(params.date);
    if (range) filter.createdAt = range;
  }
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ invoiceNumber: regex }, { subject: regex }, { method: regex }, { projectName: regex }, { remarks: regex }];
  }

  const invoices = await Invoice.find(filter).sort({ createdAt: -1 }).limit(1000).lean<any[]>();
  if (!params.excludeActivePayment) return serializeAccountingInvoices(invoices);

  const invoiceIds = invoices.map((invoice) => invoice._id);
  const activePayments = await Payment.find({ invoice: { $in: invoiceIds }, status: { $ne: 'Cancelled' } })
    .select('invoice')
    .lean();
  const paidInvoiceIds = new Set(activePayments.map((payment) => String(payment.invoice)));
  return serializeAccountingInvoices(invoices.filter((invoice) => !paidInvoiceIds.has(String(invoice._id))));
}

async function nextPaymentRef(countryId: string) {
  const country = await Country.findById(countryId).select('abbreviation flagCode').lean();
  const code = String(country?.abbreviation || country?.flagCode || 'XX').trim().toUpperCase().slice(0, 2) || 'XX';
  const count = await Payment.countDocuments({ country: countryId });
  return `${String(count + 1).padStart(4, '0')}${code}`;
}

export async function serializeAccountingPayments(payments: Array<IPayment & { _id: Types.ObjectId | string }>) {
  const countryIds = Array.from(new Set(payments.map((payment) => String(payment.country || '')).filter(Boolean)));
  const bankIds = Array.from(new Set(payments.map((payment) => String(payment.bank || '')).filter(Boolean)));
  const userIds = Array.from(new Set(payments.map((payment) => String(payment.user || '')).filter(Boolean)));
  const [countries, banks, users] = await Promise.all([
    countryIds.length ? Country.find({ _id: { $in: countryIds } }).select('name abbreviation flagCode').lean() : [],
    bankIds.length ? Bank.find({ _id: { $in: bankIds } }).select('bankName').lean() : [],
    userIds.length ? User.find({ _id: { $in: userIds } }).select('name email').lean() : [],
  ]);
  const countryMap = new Map(countries.map((country) => [String(country._id), country]));
  const bankMap = new Map(banks.map((bank) => [String(bank._id), bank]));
  const userMap = new Map(users.map((user) => [String(user._id), user]));

  return payments.map((payment) => {
    const country = countryMap.get(String(payment.country));
    const bank = bankMap.get(String(payment.bank));
    const user = userMap.get(String(payment.user || ''));
    const flagCode = String(country?.flagCode || country?.abbreviation || payment.countryFlag || '').toUpperCase();
    return {
      id: String(payment._id),
      paymentRef: payment.paymentRef,
      countryId: String(payment.country || ''),
      countryName: String(country?.name || 'Unknown Country'),
      countryAbbreviation: String(country?.abbreviation || ''),
      countryFlag: payment.countryFlag || flagFromCode(flagCode),
      datePayment: payment.datePayment ? new Date(payment.datePayment).toISOString() : '',
      invoiceId: String(payment.invoice || ''),
      invoiceNumber: payment.invoiceNumber,
      procedure: payment.procedure,
      amount: payment.amount,
      bankId: String(payment.bank || ''),
      bankName: String(bank?.bankName || 'Unknown Bank'),
      userId: String(payment.user || ''),
      userName: String(user?.name || user?.email || 'System User'),
      status: payment.status,
      cancellationReason: String(payment.cancellationReason || ''),
      createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : '',
      updatedAt: payment.updatedAt ? new Date(payment.updatedAt).toISOString() : '',
    };
  });
}

export async function listAccountingPayments(params: AccountingListParams = {}) {
  const search = params.search?.trim();
  const filter: FilterQuery<IPayment> = {};
  if (params.status && paymentStatuses.includes(params.status as PaymentStatus)) filter.status = params.status;
  if (params.countryId && Types.ObjectId.isValid(params.countryId)) filter.country = params.countryId;
  if (params.bankId && Types.ObjectId.isValid(params.bankId)) filter.bank = params.bankId;
  if (params.date) {
    const range = dateRange(params.date);
    if (range) filter.datePayment = range;
  }
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: 'i' };
    filter.$or = [{ paymentRef: regex }, { invoiceNumber: regex }, { procedure: regex }, { cancellationReason: regex }];
  }

  const payments = await Payment.find(filter).sort({ datePayment: -1, createdAt: -1 }).limit(1000).lean<any[]>();
  return serializeAccountingPayments(payments);
}

export async function createAccountingPayment(input: {
  invoiceId: string;
  bankId: string;
  datePayment?: string;
  status?: PaymentStatus;
  userId?: string;
}) {
  if (!Types.ObjectId.isValid(input.invoiceId)) throw new Error('Invoice is required.');
  if (!Types.ObjectId.isValid(input.bankId)) throw new Error('Bank is required.');

  const invoice = await Invoice.findById(input.invoiceId).lean<any>();
  if (!invoice) throw new Error('Invoice not found.');

  const duplicate = await Payment.findOne({ invoice: input.invoiceId, status: { $ne: 'Cancelled' } }).lean();
  if (duplicate) throw new Error('This invoice already has an active payment.');

  const status = paymentStatuses.includes(input.status as PaymentStatus) ? input.status! : 'Pending';
  const country = await Country.findById(invoice.countryId).select('abbreviation flagCode').lean();
  const payment = await Payment.create({
    paymentRef: await nextPaymentRef(String(invoice.countryId)),
    country: invoice.countryId,
    countryFlag: flagFromCode(String(country?.flagCode || country?.abbreviation || '')),
    invoice: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    procedure: firstProcedure(invoice),
    amount: moneyAmount(invoice),
    bank: input.bankId,
    user: Types.ObjectId.isValid(String(input.userId || '')) ? input.userId : undefined,
    datePayment: input.datePayment ? new Date(input.datePayment) : new Date(),
    status,
  });

  await Invoice.findByIdAndUpdate(invoice._id, { status });
  return (await serializeAccountingPayments([payment.toObject() as any]))[0];
}

export async function updateAccountingPaymentStatus(paymentId: string, status: PaymentStatus, cancellationReason?: string) {
  if (!Types.ObjectId.isValid(paymentId)) throw new Error('Invalid payment id.');
  if (!paymentStatuses.includes(status)) throw new Error('Invalid payment status.');
  if (status === 'Cancelled' && !String(cancellationReason || '').trim()) {
    throw new Error('Cancellation reason is required.');
  }

  const update: Partial<IPayment> = { status };
  if (status === 'Cancelled') update.cancellationReason = String(cancellationReason || '').trim();
  const payment = await Payment.findByIdAndUpdate(paymentId, update, { new: true, runValidators: true }).lean<any>();
  if (!payment) throw new Error('Payment not found.');

  await Invoice.findByIdAndUpdate(payment.invoice, {
    status,
    ...(status === 'Cancelled' ? { remarks: payment.cancellationReason } : {}),
  });

  return (await serializeAccountingPayments([payment]))[0];
}
