import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Country from '@/models/Country';
import ReferenceNumber from '@/models/ReferenceNumber';
import { getUserFromRequest } from '@/lib/auth';

const SERVICE_CODES = {
  Trademark: 'T',
  Patent: 'P',
  Design: 'D',
  Copyright: 'C',
  Other: 'O',
  Litigation: 'L',
} as const;

type ServiceType = keyof typeof SERVICE_CODES;

const buildReferenceNo = (serviceType: ServiceType, sequence: number, assignedId: string, countryCode: string) =>
  `${serviceType.charAt(0).toUpperCase()}-${sequence}${assignedId} ${countryCode}`;

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const body = await req.json();
    const countryId = String(body?.countryId || '').trim();
    const serviceType = String(body?.serviceType || '').trim() as ServiceType;
    const quantity = Number(body?.quantity);
    const assignedId = String(body?.assignedId || '').trim().toUpperCase();

    if (!countryId) return NextResponse.json({ error: 'Country is required' }, { status: 400 });
    if (!serviceType || !SERVICE_CODES[serviceType]) {
      return NextResponse.json({ error: 'Service Type is required' }, { status: 400 });
    }
    if (!assignedId) return NextResponse.json({ error: 'Assigned ID is required' }, { status: 400 });
    if (!Number.isInteger(quantity)) return NextResponse.json({ error: 'Quantity must be number only' }, { status: 400 });
    if (quantity < 1) return NextResponse.json({ error: 'Quantity minimum is 1' }, { status: 400 });
    if (quantity > 1000) return NextResponse.json({ error: 'Quantity maximum is 1000' }, { status: 400 });

    const country = await Country.findById(countryId).lean();
    if (!country || country.isActive === false) {
      return NextResponse.json({ error: 'Selected country was not found' }, { status: 404 });
    }

    const countryCode = String(country.abbreviation || '').trim().toUpperCase();
    const serviceCode = SERVICE_CODES[serviceType];
    const latest = await ReferenceNumber.findOne({ countryId, serviceType }).sort({ sequence: -1 }).lean();
    const latestSequence = Number(latest?.sequence || 0);

    const references = Array.from({ length: quantity }, (_, index) => {
      const sequence = latestSequence + index + 1;
      return {
        referenceNo: buildReferenceNo(serviceType, sequence, assignedId, countryCode),
        countryId: String(country._id),
        countryName: country.name,
        countryCode,
        serviceType,
        serviceCode,
        sequence,
        status: 'Available',
      };
    });

    return NextResponse.json({ references, latestSequence });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to generate reference numbers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
