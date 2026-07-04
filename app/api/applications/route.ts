import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ReferenceNumber from '@/models/ReferenceNumber';
import InvoicingApplication from '@/models/InvoicingApplication';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const clientId = (searchParams.get('clientId') || '').trim();
    const countryId = (searchParams.get('countryId') || '').trim();

    const filter: Record<string, unknown> = {};
    const serviceType = (searchParams.get('serviceType') || '').trim();
    if (countryId) filter.countryId = countryId;

    // follow available reference logic: if clientId is valid, include references reserved/available for that client
    const validClientId = String(clientId || '').trim();
    if (validClientId) {
      filter.usedBy = validClientId;
      filter.status = { $in: ['Reserved', 'Available'] };
    } else {
      // only truly available references when no client specified
      (filter as any).$or = [{ usedBy: { $exists: false } }, { usedBy: null }];
      filter.status = 'Available';
    }

    if (serviceType) (filter as Record<string, unknown>).serviceType = serviceType;

    const referenceRows = await ReferenceNumber.find(filter).sort({ referenceNo: 1 }).limit(500).lean();
    const referenceNos = referenceRows.map((row) => String(row.referenceNo || '').trim().toUpperCase()).filter(Boolean);
    const applicationRows = referenceNos.length
      ? await InvoicingApplication.find({ aiptReference: { $in: referenceNos } })
          .select('_id aiptReference applicationName markImage filingNumber classNo clientId countryId')
          .lean()
      : [];
    const applicationByReference = new Map(
      applicationRows.map((row) => [String(row.aiptReference || '').trim().toUpperCase(), row])
    );
    const applications = referenceRows.map((row) => {
      const linkedApplication = applicationByReference.get(String(row.referenceNo || '').trim().toUpperCase());
      return {
        ...row,
        applicationId: linkedApplication?._id ? String(linkedApplication._id) : null,
        applicationName: linkedApplication?.applicationName || '',
        filingNumber: linkedApplication?.filingNumber || '',
        classNo: linkedApplication?.classNo,
        markImage: linkedApplication?.markImage || '',
      };
    });
    return NextResponse.json({ applications });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load applications';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
