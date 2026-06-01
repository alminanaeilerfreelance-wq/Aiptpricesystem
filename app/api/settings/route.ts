import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Settings from '@/models/Settings';
import { getUserFromRequest } from '@/lib/auth';

const DEFAULT_SETTINGS = {
  companyName: 'IP Law Firm',
  companyEmail: '',
  companyPhone: '',
  companyAddress: '',
  currency: 'SAR',
  defaultValidDays: 30,
  logoUrl: '',
  termsAndConditions:
    'This quotation is valid for the specified number of days from the issue date.',
  smtpHost: '',
  smtpPort: 587,
  smtpUser: '',
  smtpPass: '',
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const settings = await Settings.findOne({}).select('-smtpPass');

    if (!settings) {
      // Return defaults (without sensitive fields) if no settings document exists yet
      const { smtpPass: _omit, ...safeDefaults } = DEFAULT_SETTINGS;
      void _omit;
      return NextResponse.json(safeDefaults);
    }

    return NextResponse.json(settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();

    // Upsert: update the first settings document or create one if none exists
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: body },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).select('-smtpPass');

    return NextResponse.json(settings);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
