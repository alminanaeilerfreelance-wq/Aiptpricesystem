import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import CompanyDetail from '@/models/CompanyDetail';
import { getUserFromRequest } from '@/lib/auth';
import { deleteCompanyLogoFile, saveCompanyLogoFile } from '@/lib/company-logo-upload';

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

type MultipartValue = string | {
  name?: string;
  size: number;
  type?: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

type MultipartFormData = {
  forEach: (callback: (value: MultipartValue, key: string) => void) => void;
  get: (key: string) => MultipartValue | null;
};

const readCompanyDetailBody = async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    const formData = (await req.formData()) as unknown as MultipartFormData;
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

    const { body, logoFile } = await readCompanyDetailBody(req);
    const existing = await CompanyDetail.findById(id);
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    const companyName =
      body?.companyName !== undefined
        ? String(body.companyName || '').trim()
        : String(existing.companyName || '');
    const address =
      body?.address !== undefined ? String(body.address || '').trim() : String(existing.address || '');
    const contact =
      body?.contact !== undefined ? String(body.contact || '').trim() : String(existing.contact || '');
    const email =
      body?.email !== undefined
        ? String(body.email || '').trim().toLowerCase()
        : String(existing.email || '');
    let logoUrl =
      body?.logoUrl !== undefined
        ? String(body.logoUrl || '').trim()
        : String(existing.logoUrl || '');
    const previousLogoUrl = String(existing.logoUrl || '');
    let uploadedLogoUrl = '';
    const serviceCategory = isValidServiceCategory(body?.serviceCategory)
      ? body.serviceCategory
      : existing.serviceCategory;

    if (!companyName) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    try {
      uploadedLogoUrl = (await saveCompanyLogoFile(logoFile)) || '';
      logoUrl = uploadedLogoUrl || logoUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid company logo upload';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const companyDetail = await CompanyDetail.findByIdAndUpdate(
      id,
      {
        $set: {
          companyName,
          address: address || undefined,
          contact: contact || undefined,
          email: email || undefined,
          logoUrl: logoUrl || undefined,
          serviceCategory,
          isActive: body?.isActive !== undefined ? body.isActive !== false : existing.isActive,
        },
        $unset: {
          continentId: '',
          continentName: '',
          countryId: '',
          countryName: '',
        },
      },
      { new: true, runValidators: true }
    );

    if (!companyDetail) {
      return NextResponse.json({ error: 'Company detail not found' }, { status: 404 });
    }

    if (uploadedLogoUrl && previousLogoUrl && previousLogoUrl !== uploadedLogoUrl) {
      await deleteCompanyLogoFile(previousLogoUrl);
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
