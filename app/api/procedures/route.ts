import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Procedure from '@/models/Procedure';
import Service from '@/models/Service';
import Country from '@/models/Country';
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
    const allParam = String(searchParams.get('all') || '').trim().toLowerCase() === 'true';

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = { isActive: true };

    if (category) {
      filter.serviceCategory = category;
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: safeSearch, $options: 'i' } },
        { serviceName: { $regex: safeSearch, $options: 'i' } },
        { serviceCategory: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [procedures, total] = await Promise.all([
      allParam
        ? Procedure.find(filter).sort({ createdAt: -1, name: 1 })
        : Procedure.find(filter).sort({ createdAt: -1, name: 1 }).skip(skip).limit(limit),
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
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const serviceId = typeof body?.serviceId === 'string' ? body.serviceId.trim() : '';
    const countryId = typeof body?.countryId === 'string' ? body.countryId.trim() : '';

    if (!name) {
      return NextResponse.json({ error: 'Procedure name is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json({ error: 'Valid service is required' }, { status: 400 });
    }

    const service = await Service.findOne({ _id: serviceId, isActive: true }).lean();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    let countryName = '';
    if (countryId) {
      if (!mongoose.Types.ObjectId.isValid(countryId)) {
        return NextResponse.json({ error: 'Valid country is required' }, { status: 400 });
      }
      const country = await Country.findOne({ _id: countryId, isActive: true }).lean();
      if (!country) {
        return NextResponse.json({ error: 'Country not found' }, { status: 404 });
      }
      countryName = String(country.name || '').trim();
    }

    const duplicateFilter: Record<string, unknown> = {
      name,
      serviceId: service._id,
      ...(countryId ? { countryId: new mongoose.Types.ObjectId(countryId) } : {}),
    };
    const duplicate = await Procedure.findOne(duplicateFilter).lean();
    if (duplicate) {
      return NextResponse.json({ error: 'Procedure already exists for this service and country' }, { status: 409 });
    }

    const procedure = await Procedure.create({
      name,
      description,
      ...(countryId ? { countryId, countryName } : {}),
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
