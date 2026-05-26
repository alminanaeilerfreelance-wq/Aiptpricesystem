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

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toUniqueObjectIdStrings = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const set = new Set<string>();
  for (const item of value) {
    if (typeof item === 'string' && mongoose.Types.ObjectId.isValid(item)) {
      set.add(item);
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
      .populate({ path: 'serviceId', select: 'name category' })
      .populate({ path: 'procedureId', select: 'name serviceCategory' })
      .populate({ path: 'countryIds', select: 'name abbreviation' })
      .populate({ path: 'clientId', select: 'name email companyName country type' })
      .lean();

    if (!inquire || !inquire.isActive) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    return NextResponse.json(inquire);
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
    if (!existing || !existing.isActive) {
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
    const finalProcedureId =
      body?.procedureId !== undefined ? String(body.procedureId || '') : String(existing.procedureId);
    const finalClientId =
      body?.clientId !== undefined ? String(body.clientId || '') : String(existing.clientId);
    const finalCountryIdStrings =
      body?.countryIds !== undefined
        ? toUniqueObjectIdStrings(body.countryIds)
        : (existing.countryIds || []).map((idValue) => String(idValue));

    if (!mongoose.Types.ObjectId.isValid(finalServiceId)) {
      return NextResponse.json({ error: 'Valid service is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(finalProcedureId)) {
      return NextResponse.json({ error: 'Valid procedure is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(finalClientId)) {
      return NextResponse.json({ error: 'Valid client is required' }, { status: 400 });
    }
    if (finalCountryIdStrings.length === 0) {
      return NextResponse.json({ error: 'At least one country is required' }, { status: 400 });
    }

    const [service, procedure, client, countries] = await Promise.all([
      Service.findOne({ _id: finalServiceId, isActive: true }).lean(),
      Procedure.findOne({ _id: finalProcedureId, isActive: true }).lean(),
      Client.findOne({ _id: finalClientId, isActive: true }).lean(),
      Country.find({ _id: { $in: finalCountryIdStrings }, isActive: true })
        .select('_id abbreviation')
        .lean(),
    ]);

    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    if (!procedure) return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    if (procedure.serviceCategory !== service.category) {
      return NextResponse.json(
        { error: 'Procedure category does not match selected service category' },
        { status: 400 }
      );
    }

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
    updatePayload.procedureId = new mongoose.Types.ObjectId(finalProcedureId);
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
      .populate({ path: 'serviceId', select: 'name category' })
      .populate({ path: 'procedureId', select: 'name serviceCategory' })
      .populate({ path: 'countryIds', select: 'name abbreviation' })
      .populate({ path: 'clientId', select: 'name email companyName country type' });

    if (!updated || !updated.isActive) {
      return NextResponse.json({ error: 'Inquire not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
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
