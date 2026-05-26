import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PricingRule from '@/models/PricingRule';
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
    const country = searchParams.get('country');
    const search = searchParams.get('search');
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');

    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit =
      Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const andFilters: Record<string, any>[] = [];

    if (category) {
      andFilters.push({ serviceCategory: category });
    }

    if (country) {
      const safeCountry = country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({
        $or: [
          { countryName: { $regex: safeCountry, $options: 'i' } },
          { countryAbbreviation: { $regex: safeCountry, $options: 'i' } },
        ],
      });
    }

    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      andFilters.push({
        $or: [
          { serviceCategory: { $regex: safeSearch, $options: 'i' } },
          { procedureName: { $regex: safeSearch, $options: 'i' } },
          { countryName: { $regex: safeSearch, $options: 'i' } },
          { countryAbbreviation: { $regex: safeSearch, $options: 'i' } },
        ],
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = {
      isActive: true,
      ...(andFilters.length > 0 ? { $and: andFilters } : {}),
    };

    const [pricingRules, total] = await Promise.all([
      PricingRule.find(filter)
        .sort({
          serviceCategory: 1,
          countryName: 1,
          procedureName: 1,
        })
        .skip(skip)
        .limit(limit),
      PricingRule.countDocuments(filter),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return NextResponse.json({ pricingRules, total, page, limit, totalPages });
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
    const pricingRule = await PricingRule.create(body);

    return NextResponse.json(pricingRule, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
