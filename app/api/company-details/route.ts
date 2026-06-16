import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import CompanyDetail from '@/models/CompanyDetail';
import { getUserFromRequest } from '@/lib/auth';
import { saveCompanyLogoFile } from '@/lib/company-logo-upload';

const SERVICE_CATEGORIES = new Set([
  'Trademark',
  'Patent',
  'Design',
  'Copyright',
  'Litigation',
]);

const isValidServiceCategory = (value: unknown): value is string =>
  typeof value === 'string' && SERVICE_CATEGORIES.has(value);

const readCompanyDetailBody = async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const formData = await req.formData();
    const body: Record<string, unknown> = {};
    formData.forEach((value, key) => {
      if (key !== 'logo') body[key] = value;
    });
    const logo = formData.get('logo');
    return {
      body,
      logoFile: logo && typeof logo !== 'string' ? logo : null,
    };
  }

  return {
    body: await req.json(),
    logoFile: null,
  };
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
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { companyName: { $regex: safeSearch, $options: 'i' } },
        { address: { $regex: safeSearch, $options: 'i' } },
        { contact: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [companyDetails, total] = await Promise.all([
      CompanyDetail.find(filter)
        .sort({ createdAt: -1, companyName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CompanyDetail.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    return NextResponse.json({ companyDetails, total, page, limit, totalPages });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { body, logoFile } = await readCompanyDetailBody(req);
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : '';
    const address = typeof body?.address === 'string' ? body.address.trim() : '';
    const contact = typeof body?.contact === 'string' ? body.contact.trim() : '';
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const existingLogoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : '';
    const serviceCategory = isValidServiceCategory(body?.serviceCategory)
      ? body.serviceCategory
      : undefined;

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    let logoUrl = existingLogoUrl || undefined;
    try {
      logoUrl = (await saveCompanyLogoFile(logoFile)) || logoUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid company logo upload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const companyDetail = await CompanyDetail.create({
      companyName,
      address: address || undefined,
      contact: contact || undefined,
      email: email || undefined,
      logoUrl,
      serviceCategory: serviceCategory || undefined,
      isActive: body?.isActive !== false,
    });

    return NextResponse.json(companyDetail, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
