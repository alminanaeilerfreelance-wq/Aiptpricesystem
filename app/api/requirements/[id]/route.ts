import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Requirement from '@/models/Requirement';
import Country from '@/models/Country';
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

    const requirement = await Requirement.findById(id).populate('country', 'name abbreviation');

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

    const { id } = await params;
    const body = await req.json();
    const { country, serviceCategory, title, requirements, upsertByCountry = false } = body;
    const safeTitle = normalizeTitle(title);
    const safeRequirements = typeof requirements === 'string' ? sanitizeRichText(requirements) : '';
    const normalizedServiceCategory =
      typeof serviceCategory === 'string' ? serviceCategory.trim() : '';

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    // Validation
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

    // Verify country exists
    const countryExists = await Country.findById(country);
    if (!countryExists) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }

    const duplicateCountry = await Requirement.findOne({
      country,
      serviceCategory: normalizedServiceCategory,
      _id: { $ne: new mongoose.Types.ObjectId(id) },
    });

    if (duplicateCountry) {
      if (upsertByCountry) {
        duplicateCountry.requirements = safeRequirements;
        duplicateCountry.title = safeTitle;
        duplicateCountry.serviceCategory = normalizedServiceCategory;
        await duplicateCountry.save();
        await Requirement.findByIdAndDelete(id);
        await duplicateCountry.populate('country', 'name abbreviation');
        return NextResponse.json(duplicateCountry, { status: 200 });
      }
      return NextResponse.json(
        { error: 'Requirement for this country already exists' },
        { status: 409 }
      );
    }

    const requirement = await Requirement.findByIdAndUpdate(
      id,
      {
        country,
        serviceCategory: normalizedServiceCategory,
        title: safeTitle,
        requirements: safeRequirements,
      },
      { new: true, runValidators: true }
    ).populate('country', 'name abbreviation');

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
    }

    return NextResponse.json(requirement, { status: 200 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'Requirement for this country already exists' },
        { status: 409 }
      );
    }
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
