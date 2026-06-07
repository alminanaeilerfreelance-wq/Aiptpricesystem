import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Requirement from '@/models/Requirement';
import Country from '@/models/Country';
import mongoose from 'mongoose';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sanitizeRichText = (value: string) => value
  .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  .replace(/\son\w+="[^"]*"/gi, '')
  .replace(/\son\w+='[^']*'/gi, '')
  .replace(/javascript:/gi, '');
const hasMeaningfulContent = (value: string) => value.replace(/<[^>]*>/g, '').trim().length > 0;
const normalizeTitle = (value: unknown) => String(value ?? '').trim();

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const rawPage = parseInt(searchParams.get('page') || '1', 10);
    const rawLimit = parseInt(searchParams.get('limit') || '10', 10);
    const rawSearch = (searchParams.get('search') || '').trim();
    const countryId = searchParams.get('countryId') || '';
    const serviceCategory = (searchParams.get('serviceCategory') || '').trim();
    const sortByParam = searchParams.get('sortBy') || 'createdAt';
    const sortBy = sortByParam === 'country' ? 'country' : 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') === 'asc' ? 1 : -1;
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;

    const search = rawSearch.slice(0, 120);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (countryId) {
      if (!mongoose.Types.ObjectId.isValid(countryId)) {
        return NextResponse.json({ error: 'Invalid countryId' }, { status: 400 });
      }
      filter.country = countryId;
    }

    if (serviceCategory) {
      filter.serviceCategory = serviceCategory;
    }

    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), 'i');
      const matchingCountries = await Country.find(
        {
          $or: [
            { name: searchRegex },
            { abbreviation: searchRegex },
          ],
        },
        { _id: 1 }
      ).lean();

      const matchingCountryIds = matchingCountries.map((country) => country._id);

      filter.$or = [
        { title: searchRegex },
        { requirements: searchRegex },
        ...(matchingCountryIds.length > 0 ? [{ country: { $in: matchingCountryIds } }] : []),
      ];
    }

    const [requirements, total] = await Promise.all([
      sortBy === 'country'
        ? Requirement.aggregate([
            { $match: filter },
            {
              $lookup: {
                from: 'countries',
                localField: 'country',
                foreignField: '_id',
                as: 'countryDoc',
              },
            },
            { $unwind: '$countryDoc' },
            { $sort: { 'countryDoc.name': sortOrder, createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                serviceCategory: 1,
                title: 1,
                requirements: 1,
                createdAt: 1,
                updatedAt: 1,
                country: {
                  _id: '$countryDoc._id',
                  name: '$countryDoc.name',
                  abbreviation: '$countryDoc.abbreviation',
                },
              },
            },
          ])
        : Requirement.find(filter)
            .populate('country', 'name abbreviation')
            .sort({ createdAt: sortOrder })
            .skip(skip)
            .limit(limit)
            .lean(),
      Requirement.countDocuments(filter),
    ]);

    return NextResponse.json(
      {
        data: requirements,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('GET /api/requirements error:', error);
    return NextResponse.json({ error: 'Failed to fetch requirements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const body = await req.json();
    const { country, serviceCategory, title, requirements, upsertByCountry = false } = body;
    const safeTitle = normalizeTitle(title);
    const safeRequirements = typeof requirements === 'string' ? sanitizeRichText(requirements) : '';

    const normalizedServiceCategory =
      typeof serviceCategory === 'string' ? serviceCategory.trim() : '';

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

    const countryExists = await Country.findById(country);
    if (!countryExists) {
      return NextResponse.json({ error: 'Country not found' }, { status: 404 });
    }

    const requirementFilter: Record<string, unknown> = { country };
    requirementFilter.serviceCategory = normalizedServiceCategory;
    const existingRequirement = await Requirement.findOne(requirementFilter);
    if (existingRequirement) {
      if (!upsertByCountry) {
        return NextResponse.json(
          { error: 'Requirement for this country already exists' },
          { status: 409 }
        );
      }

      existingRequirement.requirements = safeRequirements;
      existingRequirement.title = safeTitle;
      existingRequirement.serviceCategory = normalizedServiceCategory;
      await existingRequirement.save();
      await existingRequirement.populate('country', 'name abbreviation');
      return NextResponse.json(existingRequirement, { status: 200 });
    }

    const newRequirement = new Requirement({
      country,
      serviceCategory: normalizedServiceCategory,
      title: safeTitle,
      requirements: safeRequirements,
    });
    await newRequirement.save();
    await newRequirement.populate('country', 'name abbreviation');

    return NextResponse.json(newRequirement, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'Requirement for this country already exists' },
        { status: 409 }
      );
    }
    console.error('POST /api/requirements error:', error);
    return NextResponse.json({ error: 'Failed to create requirement' }, { status: 500 });
  }
}
