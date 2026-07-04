import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import ReferenceNumber from '@/models/ReferenceNumber';
import { getUserFromRequest } from '@/lib/auth';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');
    const countryId = (searchParams.get('countryId') || '').trim();
    const serviceType = (searchParams.get('serviceType') || '').trim();
    const clientId = (searchParams.get('clientId') || '').trim();
    const clientAssignedId = (searchParams.get('clientAssignedId') || '').trim().toUpperCase();

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (countryId) filter.countryId = countryId;
    if (serviceType) filter.serviceType = serviceType;

    const validClientId = mongoose.Types.ObjectId.isValid(clientId) ? clientId : '';
    if (clientId && !validClientId) {
      return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
    }

    // Only show references that are Available or Reserved for this client
    if (validClientId) {
      filter.$or = [
        { usedBy: validClientId, status: { $in: ['Reserved', 'Used'] } },
        { $and: [{ $or: [{ usedBy: { $exists: false } }, { usedBy: null }] }, { status: 'Available' }] },
      ];
    } else {
      filter.$or = [{ usedBy: { $exists: false } }, { usedBy: null }];
      filter.status = 'Available';
    }

    if (clientAssignedId) {
      filter.referenceNo = { $regex: escapeRegex(clientAssignedId), $options: 'i' };
    }

    const [referenceNumbers, total] = await Promise.all([
      ReferenceNumber.find(filter).sort({ referenceNo: 1 }).skip(skip).limit(limit).lean(),
      ReferenceNumber.countDocuments(filter),
    ]);

    return NextResponse.json({
      referenceNumbers,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load available reference numbers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
