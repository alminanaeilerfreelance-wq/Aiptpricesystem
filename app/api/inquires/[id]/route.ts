import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Inquire from '@/models/Inquire';
import Service from '@/models/Service';
import Procedure from '@/models/Procedure';
import Country from '@/models/Country';
import Client from '@/models/Client';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

const INQUIRE_POPULATE = [
  { path: 'serviceId', select: 'name category', strictPopulate: false },
  { path: 'procedureId', select: 'name serviceCategory', strictPopulate: false },
  { path: 'procedureIds', select: 'name serviceCategory countryName', strictPopulate: false },
  { path: 'countryIds', select: 'name abbreviation', strictPopulate: false },
  { path: 'clientId', select: 'name email companyName country type', strictPopulate: false },
];

const withArrayFallback = <T extends Record<string, unknown>>(
  record: T,
  arrayField: string,
  singleField: string
): T => {
  const arrayValue = record[arrayField];
  const singleValue = record[singleField];
  const hasArrayValue = Array.isArray(arrayValue) && arrayValue.length > 0;
  if (hasArrayValue || !singleValue) return record;

  return {
    ...record,
    [arrayField]: [singleValue],
  };
};

const normalizeInquireRecord = <T extends Record<string, unknown>>(inquire: T): T => {
  const withProcedures = withArrayFallback(inquire, 'procedureIds', 'procedureId');
  return withArrayFallback(withProcedures, 'countryIds', 'countryId');
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const extractObjectIdString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record._id === 'string') return record._id;
    if (typeof record.id === 'string') return record.id;
    if (typeof record.value === 'string') return record.value;
  }
  return '';
};

const toArrayInput = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // Fallback to comma-based parsing.
      }
    }

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }
  return value ? [value] : [];
};

const toUniqueObjectIdStrings = (value: unknown): string[] => {
  const values = toArrayInput(value);
  const set = new Set<string>();
  for (const item of values) {
    const id = extractObjectIdString(item);
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      set.add(id);
    }
  }
  return Array.from(set);
};

const normalizeCountryCode = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);

const formatSerial = (value: number): string => String(value).padStart(5, '0');

const extractSerialFromReference = (referenceNo: string): string | null => {
  const match = referenceNo.match(/^(\d{5})/);
  return match ? match[1] : null;
};

const buildReferenceNo = (serial: string, countryCodes: string[]): string =>
  `${serial}${countryCodes.join('/')}`;

const nextAvailableSerial = async (excludeId: string, preferredSerial?: string | null): Promise<string> => {
  const excludeObjectId = new mongoose.Types.ObjectId(excludeId);

  if (preferredSerial) {
    const existingPreferred = await Inquire.exists({
      _id: { $ne: excludeObjectId },
      referenceNo: { $regex: `^${escapeRegex(preferredSerial)}` },
    });
    if (!existingPreferred) return preferredSerial;
  }

  let sequence = (await Inquire.countDocuments()) + 1;

  for (let tries = 0; tries < 5000; tries += 1) {
    const candidate = formatSerial(sequence);
    const existingCandidate = await Inquire.exists({
      _id: { $ne: excludeObjectId },
      referenceNo: { $regex: `^${escapeRegex(candidate)}` },
    });
    if (!existingCandidate) return candidate;
    sequence += 1;
  }

  return formatSerial((Date.now() % 100000) + 1);
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid inquire id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const inquire = await Inquire.findById(id)
      .populate(INQUIRE_POPULATE)
      .lean();

    if (!inquire || inquire.isActive === false) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeInquireRecord(inquire as unknown as Record<string, unknown>));
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch inquire', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid inquire id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const existing = await Inquire.findById(id).lean();
    if (!existing || existing.isActive === false) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    const body = await req.json();
    const updatePayload: Record<string, unknown> = {};

    const finalInquiryDate =
      body?.inquiryDate !== undefined ? toValidDate(body.inquiryDate) : new Date(existing.inquiryDate);
    if (!finalInquiryDate) {
      return NextResponse.json({ error: 'Valid inquiry date is required' }, { status: 400 });
    }
    updatePayload.inquiryDate = finalInquiryDate;

    const finalServiceId =
      body?.serviceId !== undefined ? String(body.serviceId || '') : String(existing.serviceId);
    const finalProcedureIdStrings =
      body?.procedureIds !== undefined
        ? toUniqueObjectIdStrings(body.procedureIds)
        : body?.procedureId !== undefined
          ? mongoose.Types.ObjectId.isValid(String(body.procedureId || ''))
            ? [String(body.procedureId || '')]
            : []
          : Array.isArray((existing as any).procedureIds) && (existing as any).procedureIds.length > 0
            ? (existing as any).procedureIds.map((idValue: unknown) => String(idValue))
            : String((existing as any).procedureId || '')
              ? [String((existing as any).procedureId)]
              : [];
    const finalClientId =
      body?.clientId !== undefined ? String(body.clientId || '') : String(existing.clientId);
    const finalCountryIdStrings =
      body?.countryIds !== undefined
        ? toUniqueObjectIdStrings(body.countryIds)
        : (existing.countryIds || []).map((idValue) => String(idValue));

    if (!mongoose.Types.ObjectId.isValid(finalServiceId)) {
      return NextResponse.json({ error: 'Valid service is required' }, { status: 400 });
    }
    if (finalProcedureIdStrings.length === 0) {
      return NextResponse.json({ error: 'At least one valid procedure is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(finalClientId)) {
      return NextResponse.json({ error: 'Valid client is required' }, { status: 400 });
    }
    if (finalCountryIdStrings.length === 0) {
      return NextResponse.json({ error: 'At least one country is required' }, { status: 400 });
    }

    const [service, procedures, client, countries] = await Promise.all([
      Service.findOne({ _id: finalServiceId, isActive: true }).lean(),
      Procedure.find({ _id: { $in: finalProcedureIdStrings }, isActive: true }).lean(),
      Client.findOne({ _id: finalClientId, isActive: true }).lean(),
      Country.find({ _id: { $in: finalCountryIdStrings }, isActive: true })
        .select('_id abbreviation')
        .lean(),
    ]);

    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    if (procedures.length !== finalProcedureIdStrings.length) {
      return NextResponse.json({ error: 'One or more selected procedures are invalid' }, { status: 404 });
    }
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (countries.length !== finalCountryIdStrings.length) {
      return NextResponse.json({ error: 'One or more selected countries are invalid' }, { status: 400 });
    }

    const countryById = new Map(countries.map((country) => [String(country._id), country]));
    const countryCodes = finalCountryIdStrings
      .map((idValue) => countryById.get(idValue))
      .filter((country): country is NonNullable<typeof country> => Boolean(country))
      .map((country) => normalizeCountryCode(country.abbreviation || ''))
      .filter(Boolean);

    if (countryCodes.length === 0) {
      return NextResponse.json({ error: 'Unable to generate reference from selected countries' }, { status: 400 });
    }

    const preferredSerial = extractSerialFromReference(existing.referenceNo || '');
    const serial = await nextAvailableSerial(id, preferredSerial);

    updatePayload.referenceNo = buildReferenceNo(serial, countryCodes);
    updatePayload.serviceId = new mongoose.Types.ObjectId(finalServiceId);
    updatePayload.procedureId = new mongoose.Types.ObjectId(finalProcedureIdStrings[0]);
    updatePayload.procedureIds = finalProcedureIdStrings.map(
      (idValue: string) => new mongoose.Types.ObjectId(idValue)
    );
    updatePayload.clientId = new mongoose.Types.ObjectId(finalClientId);
    updatePayload.countryIds = finalCountryIdStrings.map((idValue) => new mongoose.Types.ObjectId(idValue));
    updatePayload.countryCodes = countryCodes;
    if (body?.remarks !== undefined) {
      updatePayload.remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
    }

    const updated = await Inquire.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    )
      .populate(INQUIRE_POPULATE);

    if (!updated || updated.isActive === false) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    return NextResponse.json(normalizeInquireRecord(updated.toObject() as Record<string, unknown>));
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid inquire payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to update inquire', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid inquire id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const deleted = await Inquire.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });

    if (!deleted) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Inquire deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete inquire', err), { status: 500 });
  }
}
