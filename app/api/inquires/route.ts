import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Inquire from '@/models/Inquire';
import Service from '@/models/Service';
import Procedure from '@/models/Procedure';
import Country from '@/models/Country';
import Client from '@/models/Client';
import { getUserFromRequest } from '@/lib/auth';

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

const buildReferenceNo = (serial: string, countryCodes: string[]): string =>
  `${serial}${countryCodes.join('/')}`;

const nextAvailableSerial = async (): Promise<string> => {
  let sequence = (await Inquire.countDocuments()) + 1;

  for (let tries = 0; tries < 5000; tries += 1) {
    const candidate = formatSerial(sequence);
    const exists = await Inquire.exists({
      referenceNo: { $regex: `^${escapeRegex(candidate)}` },
    });
    if (!exists) return candidate;
    sequence += 1;
  }

  return formatSerial((Date.now() % 100000) + 1);
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (search) {
      const safeSearch = escapeRegex(search);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const orFilters: Record<string, any>[] = [
        { referenceNo: { $regex: safeSearch, $options: 'i' } },
        { remarks: { $regex: safeSearch, $options: 'i' } },
      ];

      const [services, procedures, countries, clients] = await Promise.all([
        Service.find({
          isActive: true,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { category: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } },
          ],
        })
          .select('_id')
          .lean(),
        Procedure.find({
          isActive: true,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { serviceCategory: { $regex: safeSearch, $options: 'i' } },
            { description: { $regex: safeSearch, $options: 'i' } },
          ],
        })
          .select('_id')
          .lean(),
        Country.find({
          isActive: true,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { abbreviation: { $regex: safeSearch, $options: 'i' } },
            { flagCode: { $regex: safeSearch, $options: 'i' } },
          ],
        })
          .select('_id')
          .lean(),
        Client.find({
          isActive: true,
          $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { email: { $regex: safeSearch, $options: 'i' } },
            { phone: { $regex: safeSearch, $options: 'i' } },
            { companyName: { $regex: safeSearch, $options: 'i' } },
            { country: { $regex: safeSearch, $options: 'i' } },
            { notes: { $regex: safeSearch, $options: 'i' } },
          ],
        })
          .select('_id')
          .lean(),
      ]);

      if (services.length > 0) {
        orFilters.push({ serviceId: { $in: services.map((item) => item._id) } });
      }
      if (procedures.length > 0) {
        orFilters.push({ procedureId: { $in: procedures.map((item) => item._id) } });
      }
      if (countries.length > 0) {
        orFilters.push({ countryIds: { $in: countries.map((item) => item._id) } });
      }
      if (clients.length > 0) {
        orFilters.push({ clientId: { $in: clients.map((item) => item._id) } });
      }

      if (/^\d{4}$/.test(search)) {
        const yearStart = new Date(`${search}-01-01T00:00:00.000Z`);
        const yearEnd = new Date(`${Number(search) + 1}-01-01T00:00:00.000Z`);
        orFilters.push({ inquiryDate: { $gte: yearStart, $lt: yearEnd } });
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(search)) {
        const dayStart = new Date(`${search}T00:00:00.000Z`);
        const dayEnd = new Date(dayStart);
        dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
        orFilters.push({ inquiryDate: { $gte: dayStart, $lt: dayEnd } });
      }

      filter.$or = orFilters;
    }

    const [inquires, total] = await Promise.all([
      Inquire.find(filter)
        .populate({ path: 'serviceId', select: 'name category' })
        .populate({ path: 'procedureId', select: 'name serviceCategory' })
        .populate({ path: 'countryIds', select: 'name abbreviation' })
        .populate({ path: 'clientId', select: 'name email companyName country type' })
        .sort({ inquiryDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inquire.countDocuments(filter),
    ]);

    return NextResponse.json({
      inquires,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load inquires', err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();

    const inquiryDate = toValidDate(body?.inquiryDate);
    if (!inquiryDate) {
      return NextResponse.json({ error: 'Valid inquiry date is required' }, { status: 400 });
    }

    const serviceId = typeof body?.serviceId === 'string' ? body.serviceId : '';
    const procedureId = typeof body?.procedureId === 'string' ? body.procedureId : '';
    const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
    const countryIdStrings = toUniqueObjectIdStrings(body?.countryIds);

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json({ error: 'Valid service is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(procedureId)) {
      return NextResponse.json({ error: 'Valid procedure is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return NextResponse.json({ error: 'Valid client is required' }, { status: 400 });
    }
    if (countryIdStrings.length === 0) {
      return NextResponse.json({ error: 'At least one country is required' }, { status: 400 });
    }

    const [service, procedure, client, countries] = await Promise.all([
      Service.findOne({ _id: serviceId, isActive: true }).lean(),
      Procedure.findOne({ _id: procedureId, isActive: true }).lean(),
      Client.findOne({ _id: clientId, isActive: true }).lean(),
      Country.find({ _id: { $in: countryIdStrings }, isActive: true })
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

    if (countries.length !== countryIdStrings.length) {
      return NextResponse.json({ error: 'One or more selected countries are invalid' }, { status: 400 });
    }

    const countryById = new Map(countries.map((country) => [String(country._id), country]));
    const countryCodes = countryIdStrings
      .map((id) => countryById.get(id))
      .filter((country): country is NonNullable<typeof country> => Boolean(country))
      .map((country) => normalizeCountryCode(country.abbreviation || ''))
      .filter(Boolean);

    if (countryCodes.length === 0) {
      return NextResponse.json({ error: 'Unable to generate reference from selected countries' }, { status: 400 });
    }

    const serial = await nextAvailableSerial();
    const referenceNo = buildReferenceNo(serial, countryCodes);

    const created = await Inquire.create({
      inquiryDate,
      serviceId: new mongoose.Types.ObjectId(serviceId),
      procedureId: new mongoose.Types.ObjectId(procedureId),
      countryIds: countryIdStrings.map((id) => new mongoose.Types.ObjectId(id)),
      countryCodes,
      clientId: new mongoose.Types.ObjectId(clientId),
      referenceNo,
      remarks: typeof body?.remarks === 'string' ? body.remarks.trim() : undefined,
    });

    const populated = await created.populate([
      { path: 'serviceId', select: 'name category' },
      { path: 'procedureId', select: 'name serviceCategory' },
      { path: 'countryIds', select: 'name abbreviation' },
      { path: 'clientId', select: 'name email companyName country type' },
    ]);

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid inquire payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to create inquire', err), { status: 500 });
  }
}
