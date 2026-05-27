import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Procedure from '@/models/Procedure';
import Country from '@/models/Country';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (category) {
      filter.serviceCategory = category;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { countryName: { $regex: safeSearch, $options: 'i' } },
        { serviceName: { $regex: safeSearch, $options: 'i' } },
        { serviceCategory: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [procedures, total] = await Promise.all([
      Procedure.find(filter)
        .sort({ createdAt: -1, name: 1 })
        .skip(skip)
        .limit(limit),
      Procedure.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ procedures, total, page, limit, totalPages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const countryId = typeof body?.countryId === 'string' ? body.countryId.trim() : '';
    const serviceId = typeof body?.serviceId === 'string' ? body.serviceId.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Procedure name is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(countryId)) {
      return NextResponse.json({ error: 'Valid country is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json({ error: 'Valid service type is required' }, { status: 400 });
    }

    const [country, service] = await Promise.all([
      Country.findOne({ _id: countryId, isActive: true }).lean(),
      Service.findOne({ _id: serviceId, isActive: true }).lean(),
    ]);

    if (!country) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const procedure = await Procedure.create({
      name,
      countryId,
      countryName: country.name,
      serviceId,
      serviceName: service.name,
      serviceCategory: service.category,
      isActive: body?.isActive !== false,
    });

    return NextResponse.json(procedure, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
