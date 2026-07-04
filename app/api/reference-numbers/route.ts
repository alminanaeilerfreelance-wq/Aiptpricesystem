import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ReferenceNumber from '@/models/ReferenceNumber';
import { getUserFromRequest } from '@/lib/auth';

const allowedSortFields = new Set(['referenceNo', 'countryName', 'serviceType', 'sequence', 'status', 'createdAt']);

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');
    const search = (searchParams.get('search') || '').trim();
    const countryId = (searchParams.get('countryId') || '').trim();
    const serviceType = (searchParams.get('serviceType') || '').trim();
    const status = (searchParams.get('status') || '').trim();
    const usedBy = (searchParams.get('usedBy') || '').trim();
    const sortByParam = (searchParams.get('sortBy') || 'createdAt').trim();
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 1 : -1;

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 200) : 10;
    const skip = (page - 1) * limit;
    const sortBy = allowedSortFields.has(sortByParam) ? sortByParam : 'createdAt';

    const filter: Record<string, any> = {};
    if (countryId) filter.countryId = countryId;
    if (serviceType) filter.serviceType = serviceType;
    if (status) filter.status = status;
    if (usedBy) filter.usedBy = usedBy;
    if (search) {
      const safeSearch = escapeRegex(search);
      filter.$or = [
        { referenceNo: { $regex: safeSearch, $options: 'i' } },
        { countryName: { $regex: safeSearch, $options: 'i' } },
        { countryCode: { $regex: safeSearch, $options: 'i' } },
        { serviceType: { $regex: safeSearch, $options: 'i' } },
        { serviceCode: { $regex: safeSearch, $options: 'i' } },
        { status: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [rows, total] = await Promise.all([
      ReferenceNumber.find(filter)
        .populate({ path: 'usedBy', select: 'name assignedId', strictPopulate: false })
        .sort({ [sortBy]: sortOrder, _id: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReferenceNumber.countDocuments(filter),
    ]);
    const referenceNumbers = rows.map((row) => {
      const usedByClient =
        row.usedBy && typeof row.usedBy === 'object'
          ? (row.usedBy as { _id?: unknown; name?: string; assignedId?: string })
          : null;
      return {
        ...row,
        usedBy: usedByClient?._id ? String(usedByClient._id) : row.usedBy,
        usedByClientName: usedByClient?.name || '',
        usedByAssignedId: usedByClient?.assignedId || '',
      };
    });

    return NextResponse.json({
      referenceNumbers,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load reference numbers';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
