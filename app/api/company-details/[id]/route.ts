import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import CompanyDetail from '@/models/CompanyDetail';
import Continent from '@/models/Continent';
import Country from '@/models/Country';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SERVICE_CATEGORIES = new Set([
  'Trademark',
  'Patent',
  'Design',
  'Copyright',
  'Litigation',
]);

const isValidServiceCategory = (value: unknown): value is string =>
  typeof value === 'string' && SERVICE_CATEGORIES.has(value);

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid company detail id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const companyDetail = await CompanyDetail.findById(id).lean();
    if (!companyDetail || !companyDetail.isActive) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    return NextResponse.json(companyDetail);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid company detail id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const body = await req.json();
    const existing = await CompanyDetail.findById(id);
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    const companyName =
      body?.companyName !== undefined
        ? String(body.companyName || '').trim()
        : String(existing.companyName || '');
    const continentId =
      body?.continentId !== undefined
        ? String(body.continentId || '').trim()
        : String(existing.continentId || '');
    const countryId =
      body?.countryId !== undefined ? String(body.countryId || '').trim() : String(existing.countryId || '');
    const address =
      body?.address !== undefined ? String(body.address || '').trim() : String(existing.address || '');
    const contact =
      body?.contact !== undefined ? String(body.contact || '').trim() : String(existing.contact || '');
    const email =
      body?.email !== undefined
        ? String(body.email || '').trim().toLowerCase()
        : String(existing.email || '');
    const serviceCategory = isValidServiceCategory(body?.serviceCategory)
      ? body.serviceCategory
      : existing.serviceCategory;

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(continentId)) {
      return NextResponse.json({ error: 'Valid continent is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(countryId)) {
      return NextResponse.json({ error: 'Valid country is required' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const [continent, country] = await Promise.all([
      Continent.findOne({ _id: continentId, isActive: true }).lean(),
      Country.findOne({ _id: countryId, isActive: true }).lean(),
    ]);

    if (!continent) {
      return NextResponse.json({ error: 'Continent not found' }, { status: 404 });
    }
    if (!country) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }

    const companyDetail = await CompanyDetail.findByIdAndUpdate(
      id,
      {
        $set: {
          continentId,
          continentName: continent.continent,
          countryId,
          countryName: country.name,
          companyName,
          address: address || undefined,
          contact: contact || undefined,
          email: email || undefined,
          serviceCategory,
          isActive: body?.isActive !== undefined ? body.isActive !== false : existing.isActive,
        },
      },
      { new: true, runValidators: true }
    );

    if (!companyDetail) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    return NextResponse.json(companyDetail);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid company detail id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const companyDetail = await CompanyDetail.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!companyDetail) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Company detail deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
