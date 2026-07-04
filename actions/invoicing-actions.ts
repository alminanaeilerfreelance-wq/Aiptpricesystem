'use server';

import { FilterQuery, Types } from 'mongoose';
import connectDB from '@/lib/mongodb';
import Bank, { type IBank } from '@/models/Bank';
import Client from '@/models/Client';
import Country from '@/models/Country';
import InvoicingApplication, { type IInvoicingApplication } from '@/models/InvoicingApplication';
import ReferenceNumber from '@/models/ReferenceNumber';
import {
  bankFormSchema,
  serviceApplicationFormSchema,
  type BankFormInput,
  type ServiceApplicationFormInput,
  type ServiceApplicationFormValues,
} from '@/schemas/invoicing-schema';
import {
  serviceModuleTypes,
  type BankRecord,
  type InvoicingListParams,
  type InvoicingListResult,
  type InvoicingModuleType,
  type InvoicingRecord,
  type ServiceApplicationRecord,
  type ServiceModuleType,
} from '@/types/invoicing';

type BankLean = Omit<IBank, keyof Document> & { _id: Types.ObjectId | string };
type ApplicationLean = Omit<IInvoicingApplication, keyof Document> & {
  _id: Types.ObjectId | string;
  clientId: Types.ObjectId | string;
  countryId: Types.ObjectId | string;
  aiptReferenceId?: Types.ObjectId | string;
};

const bankSortFields = new Set([
  'bankName',
  'bankHeader',
  'bankDescription',
  'accountName',
  'accountNumber',
  'iban',
  'swift',
  'currency',
  'status',
  'createdAt',
  'updatedAt',
]);
const serviceSortFields = new Set([
  'applicationName',
  'filingNumber',
  'aiptReference',
  'classNo',
  'createdAt',
  'updatedAt',
]);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureObjectId(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new Error('Invalid record id.');
}

function ensureModuleType(moduleType: InvoicingModuleType) {
  if (moduleType !== 'Bank' && !serviceModuleTypes.includes(moduleType as ServiceModuleType)) {
    throw new Error('Invalid module type.');
  }
}

function serializeBank(bank: BankLean): BankRecord {
  return {
    id: String(bank._id),
    bankName: bank.bankName,
    logoUrl: bank.logoUrl || null,
    bankHeader: bank.bankHeader,
    bankDescription: bank.bankDescription,
    accountName: bank.accountName || null,
    accountNumber: bank.accountNumber || null,
    iban: bank.iban || null,
    swift: bank.swift || null,
    currency: bank.currency || null,
    status: bank.status || 'Active',
    createdAt: bank.createdAt.toISOString(),
    updatedAt: bank.updatedAt.toISOString(),
  };
}

async function loadLookupNames(records: ApplicationLean[]) {
  const clientIds = Array.from(new Set(records.map((record) => String(record.clientId)).filter(Boolean)));
  const countryIds = Array.from(new Set(records.map((record) => String(record.countryId)).filter(Boolean)));

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

function serializeApplication(
  record: ApplicationLean,
  clientNames: Map<string, string>,
  countryNames: Map<string, string>
): ServiceApplicationRecord {
  const clientId = String(record.clientId);
  const countryId = String(record.countryId);

  return {
    id: String(record._id),
    moduleType: record.moduleType,
    clientId,
    clientName: clientNames.get(clientId) || 'Unknown Client',
    countryId,
    countryName: countryNames.get(countryId) || 'Unknown Country',
    aiptReferenceId: record.aiptReferenceId ? String(record.aiptReferenceId) : null,
    aiptReference: record.aiptReference,
    classNo: record.classNo,
    filingNumber: record.filingNumber,
    applicationName: record.applicationName,
    allowDuplicateFilingNumber: record.allowDuplicateFilingNumber,
    status: (record as any).status || 'Active',
    markImage: record.markImage,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function buildServiceData(input: ServiceApplicationFormValues) {
  return {
    moduleType: input.moduleType,
    clientId: new Types.ObjectId(input.clientId),
    countryId: new Types.ObjectId(input.countryId),
    aiptReferenceId: input.aiptReferenceId ? new Types.ObjectId(input.aiptReferenceId) : undefined,
    aiptReference: input.aiptReference,
    classNo: input.moduleType === 'Trademark' ? input.classNo : undefined,
    filingNumber: input.filingNumber,
    applicationName: input.applicationName,
    allowDuplicateFilingNumber: Boolean(input.allowDuplicateFilingNumber),
    markImage: input.moduleType === 'Trademark' ? input.markImage : undefined,
  };
}

async function reserveReference(input: ServiceApplicationFormValues, recordId: Types.ObjectId, oldReferenceId?: string) {
  if (oldReferenceId && oldReferenceId !== input.aiptReferenceId) {
    await ReferenceNumber.findByIdAndUpdate(oldReferenceId, {
      status: 'Available',
      $unset: { usedBy: 1, usedDate: 1 },
    });
  }

  if (!input.aiptReferenceId) return;

  await ReferenceNumber.findByIdAndUpdate(input.aiptReferenceId, {
    status: 'Used',
    usedBy: input.clientId,
    usedDate: new Date(),
  });
}

async function assertDuplicateAiptReferenceAllowed(input: ServiceApplicationFormValues, excludeId?: string) {
  if (!input.aiptReferenceId) return;

  const duplicate = await InvoicingApplication.findOne({
    moduleType: input.moduleType,
    aiptReferenceId: input.aiptReferenceId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();

  if (duplicate) {
    throw new Error('This AIPT Reference is already used.');
  }
}

async function assertDuplicateFilingAllowed(input: ServiceApplicationFormValues, excludeId?: string) {
  if (!input.filingNumber) return;
  if (input.moduleType === 'Trademark' && input.allowDuplicateFilingNumber) return;

  const duplicate = await InvoicingApplication.findOne({
    moduleType: input.moduleType,
    filingNumber: input.filingNumber,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();

  if (duplicate) {
    throw new Error('Filing number already exists. Enable duplicate filing number to continue.');
  }
}

export async function listInvoicingRecords(params: InvoicingListParams): Promise<InvoicingListResult> {
  ensureModuleType(params.moduleType);
  await connectDB();

  const page = Math.max(Number(params.page || 1), 1);
  const pageSize = Math.min(Math.max(Number(params.pageSize || 10), 1), 100);
  const search = params.search?.trim();
  const sortDirection = params.sortDirection === 'asc' ? 1 : -1;

  if (params.moduleType === 'Bank') {
    const sortBy = bankSortFields.has(params.sortBy || '') ? params.sortBy! : 'bankName';
    const filter: FilterQuery<IBank> = search
      ? {
          $or: [
            { bankName: { $regex: escapeRegex(search), $options: 'i' } },
            { bankHeader: { $regex: escapeRegex(search), $options: 'i' } },
            { bankDescription: { $regex: escapeRegex(search), $options: 'i' } },
            { accountName: { $regex: escapeRegex(search), $options: 'i' } },
            { accountNumber: { $regex: escapeRegex(search), $options: 'i' } },
            { iban: { $regex: escapeRegex(search), $options: 'i' } },
            { swift: { $regex: escapeRegex(search), $options: 'i' } },
            { currency: { $regex: escapeRegex(search), $options: 'i' } },
            { status: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {};

    const [banks, total] = await Promise.all([
      Bank.find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<BankLean[]>(),
      Bank.countDocuments(filter),
    ]);

    return {
      records: banks.map(serializeBank),
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  const sortBy = serviceSortFields.has(params.sortBy || '') ? params.sortBy! : 'createdAt';
  const filter: FilterQuery<IInvoicingApplication> = {
    moduleType: params.moduleType,
    ...(search
      ? {
          $or: [
            { applicationName: { $regex: escapeRegex(search), $options: 'i' } },
            { filingNumber: { $regex: escapeRegex(search), $options: 'i' } },
            { aiptReference: { $regex: escapeRegex(search), $options: 'i' } },
          ],
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    InvoicingApplication.find(filter)
      .sort({ [sortBy]: sortDirection })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<ApplicationLean[]>(),
    InvoicingApplication.countDocuments(filter),
  ]);

  const { clientNames, countryNames } = await loadLookupNames(records);

  return {
    records: records.map((record) => serializeApplication(record, clientNames, countryNames)),
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export async function listUsedAiptReferenceIds(
  moduleType: ServiceModuleType,
  excludeId?: string
): Promise<string[]> {
  ensureModuleType(moduleType);
  if (excludeId) ensureObjectId(excludeId);
  await connectDB();

  const records = await InvoicingApplication.find({
    moduleType,
    aiptReferenceId: { $exists: true },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select('aiptReferenceId')
    .lean<Array<{ aiptReferenceId?: Types.ObjectId | string }>>();

  return Array.from(
    new Set(records.map((record) => (record.aiptReferenceId ? String(record.aiptReferenceId) : '')).filter(Boolean))
  );
}

export async function createBankRecord(input: BankFormInput): Promise<BankRecord> {
  const parsed = bankFormSchema.parse(input);
  await connectDB();
  const created = (await Bank.create(parsed)).toObject() as BankLean;
  return serializeBank(created);
}

export async function updateBankRecord(id: string, input: BankFormInput): Promise<BankRecord> {
  ensureObjectId(id);
  const parsed = bankFormSchema.parse(input);
  await connectDB();

  const updated = await Bank.findByIdAndUpdate(id, parsed, { new: true, runValidators: true }).lean<BankLean | null>();
  if (!updated) throw new Error('Bank not found.');
  return serializeBank(updated);
}

export async function createServiceRecord(input: ServiceApplicationFormInput): Promise<ServiceApplicationRecord> {
  const parsed = serviceApplicationFormSchema.parse(input);
  await connectDB();
  await assertDuplicateFilingAllowed(parsed);
  await assertDuplicateAiptReferenceAllowed(parsed);

  const createdDocument = await InvoicingApplication.create(buildServiceData(parsed));
  await reserveReference(parsed, createdDocument._id);

  const created = createdDocument.toObject() as ApplicationLean;
  const { clientNames, countryNames } = await loadLookupNames([created]);
  return serializeApplication(created, clientNames, countryNames);
}

export async function updateServiceRecord(
  id: string,
  input: ServiceApplicationFormInput
): Promise<ServiceApplicationRecord> {
  ensureObjectId(id);
  const parsed = serviceApplicationFormSchema.parse(input);
  await connectDB();
  await assertDuplicateFilingAllowed(parsed, id);
  await assertDuplicateAiptReferenceAllowed(parsed, id);

  const current = await InvoicingApplication.findById(id).lean<ApplicationLean | null>();
  const updated = await InvoicingApplication.findByIdAndUpdate(id, buildServiceData(parsed), {
    new: true,
    runValidators: true,
  }).lean<ApplicationLean | null>();

  if (!updated) throw new Error('Record not found.');
  await reserveReference(parsed, new Types.ObjectId(id), current?.aiptReferenceId ? String(current.aiptReferenceId) : undefined);

  const { clientNames, countryNames } = await loadLookupNames([updated]);
  return serializeApplication(updated, clientNames, countryNames);
}

export async function deleteInvoicingRecord(moduleType: InvoicingModuleType, id: string): Promise<{ success: true }> {
  ensureModuleType(moduleType);
  ensureObjectId(id);
  await connectDB();

  if (moduleType === 'Bank') {
    await Bank.findByIdAndUpdate(id, { status: 'Abandon' }, { new: true });
    return { success: true };
  }

  // Mark as Abandoned instead of deleting
  const updated = await InvoicingApplication.findByIdAndUpdate(
    id,
    { status: 'Abandon' },
    { new: true }
  ).lean<ApplicationLean | null>();

  if (!updated) throw new Error('Record not found.');

  // Do NOT free the reference number on abandon to preserve history and blocking behavior.

  return { success: true };
}

export async function updateInvoicingStatus(
  moduleType: InvoicingModuleType,
  id: string,
  status: 'Active' | 'Abandon' | 'Cancel'
): Promise<InvoicingRecord> {
  ensureModuleType(moduleType);
  ensureObjectId(id);
  await connectDB();

  if (moduleType === 'Bank') {
    const updated = await Bank.findByIdAndUpdate(id, { status }, { new: true, runValidators: true }).lean<BankLean | null>();
    if (!updated) throw new Error('Bank not found.');
    return serializeBank(updated);
  }

  const updated = await InvoicingApplication.findByIdAndUpdate(id, { status }, { new: true }).lean<ApplicationLean | null>();
  if (!updated) throw new Error('Record not found.');

  const { clientNames, countryNames } = await loadLookupNames([updated]);
  return serializeApplication(updated, clientNames, countryNames);
}
