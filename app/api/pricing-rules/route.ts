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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };

    if (category) {
      filter.serviceCategory = category;
    }

    if (country) {
      filter.$or = [
        { countryName: { $regex: country, $options: 'i' } },
        { countryAbbreviation: { $regex: country, $options: 'i' } },
      ];
    }

    const pricingRules = await PricingRule.find(filter).sort({
      serviceCategory: 1,
      countryName: 1,
      procedureName: 1,
    });

    return NextResponse.json({ pricingRules, total: pricingRules.length });
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
