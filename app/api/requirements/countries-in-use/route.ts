import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Requirement from '@/models/Requirement';

export async function GET() {
  try {
    await connectDB();

    const distinctCountryIds = await Requirement.distinct('country');
    const countryIds = distinctCountryIds.map((id: unknown) => String(id));

    return NextResponse.json({ countryIds }, { status: 200 });
  } catch (error) {
    console.error('GET /api/requirements/countries-in-use error:', error);
    return NextResponse.json({ error: 'Failed to fetch countries in use' }, { status: 500 });
  }
}
