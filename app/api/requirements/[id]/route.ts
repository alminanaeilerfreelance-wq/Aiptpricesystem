import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Requirement, { ensureRequirementDuplicatesAllowed } from '@/models/Requirement';
import Country from '@/models/Country';
import Procedure from '@/models/Procedure';
import Service from '@/models/Service';
import mongoose from 'mongoose';

const sanitizeRichText = (value: string) => value
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/\son\w+='[^']*'/gi, '')
  .replace(/javascript:/gi, '');
const hasMeaningfulContent = (value: string) => value.replace(/<[^>]*>/g, '').trim().length > 0;
const normalizeTitle = (value: unknown) => String(value ?? '').trim();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const requirement = await Requirement.findById(id)
      .populate('country', 'name abbreviation')
      .populate('serviceId', 'name category')
      .populate('procedureId', 'name serviceCategory');

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    return NextResponse.json(requirement, { status: 200 });
  } catch (error) {
    console.error('GET /api/requirements/[id] error:', error);
    return NextResponse.json({ error: 'Failed to fetch requirement' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    await ensureRequirementDuplicatesAllowed();

    const { id } = await params;
    const body = await req.json();
    const { country, serviceId, serviceCategory, title, requirements, procedureId, procedureName, isActive } = body;
    const safeTitle = normalizeTitle(title);
    const safeRequirements = typeof requirements === 'string' ? sanitizeRichText(requirements) : '';
    let normalizedServiceCategory =
      typeof serviceCategory === 'string' ? serviceCategory.trim() : '';
    const rawServiceId = typeof serviceId === 'string' ? serviceId.trim() : '';
    const rawProcedureId = typeof procedureId === 'string' ? procedureId.trim() : '';
    let safeProcedureName = typeof procedureName === 'string' ? procedureName.trim() : '';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const countryExists = await Country.findById(country);
    if (!countryExists) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }

    let serviceObjectId: mongoose.Types.ObjectId | undefined;
    let safeServiceName = '';
    if (rawServiceId) {
      if (!mongoose.Types.ObjectId.isValid(rawServiceId)) {
        return NextResponse.json({ error: 'Invalid serviceId' }, { status: 400 });
      }
      const service = await Service.findById(rawServiceId).lean();
      if (!service) {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      serviceObjectId = new mongoose.Types.ObjectId(rawServiceId);
      safeServiceName = String(service.name || '').trim();
      normalizedServiceCategory = String(service.category || normalizedServiceCategory).trim();
    }

    if (
      !country ||
      !normalizedServiceCategory ||
      !safeTitle ||
      !safeRequirements ||
      !hasMeaningfulContent(safeRequirements)
    ) {
      return NextResponse.json(
        { error: 'Missing required fields: country, service, title, requirements' },
        { status: 400 }
      );
    }

    let procedureObjectId: mongoose.Types.ObjectId | undefined;
    if (rawProcedureId) {
      if (!mongoose.Types.ObjectId.isValid(rawProcedureId)) {
        return NextResponse.json({ error: 'Invalid procedureId' }, { status: 400 });
      }
      const procedure = await Procedure.findById(rawProcedureId).lean();
      if (!procedure) {
        return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
      }
      procedureObjectId = new mongoose.Types.ObjectId(rawProcedureId);
      safeProcedureName = String(procedure.name || safeProcedureName).trim();
    }

    const requirement = await Requirement.findByIdAndUpdate(
      id,
      {
        country,
        ...(serviceObjectId ? { serviceId: serviceObjectId, serviceName: safeServiceName } : {}),
        ...(procedureObjectId ? { procedureId: procedureObjectId } : {}),
        ...(safeProcedureName ? { procedureName: safeProcedureName } : {}),
        serviceCategory: normalizedServiceCategory,
        title: safeTitle,
        requirements: safeRequirements,
        isActive: isActive !== false,
      },
      { new: true, runValidators: true }
    )
      .populate('country', 'name abbreviation')
      .populate('serviceId', 'name category')
      .populate('procedureId', 'name serviceCategory');

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    return NextResponse.json(requirement, { status: 200 });
  } catch (error: any) {
    console.error('PUT /api/requirements/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update requirement' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();

    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const requirement = await Requirement.findByIdAndDelete(id);

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Requirement deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error('DELETE /api/requirements/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete requirement' }, { status: 500 });
  }
}
