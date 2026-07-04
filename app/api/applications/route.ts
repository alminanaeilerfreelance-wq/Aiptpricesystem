import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ReferenceNumber from '@/models/ReferenceNumber';
import InvoicingApplication from '@/models/InvoicingApplication';
import { getUserFromRequest } from '@/lib/auth';

const normalizeModuleType = (value: string) => {
  if (/trademark/i.test(value)) return 'Trademark';
  if (/patent/i.test(value)) return 'Patent';
  if (/design/i.test(value)) return 'Design';
  if (/copyright/i.test(value)) return 'Copyright';
  if (/litigation/i.test(value)) return 'Litigation';
  if (/other/i.test(value)) return 'Others';
  return '';
};

const normalizeReferenceServiceType = (value: string) =>
  normalizeModuleType(value) === 'Others' ? 'Other' : normalizeModuleType(value);

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const clientId = (searchParams.get('clientId') || '').trim();
    const countryId = (searchParams.get('countryId') || '').trim();
    const ids = (searchParams.get('ids') || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const filter: Record<string, unknown> = {};
    const serviceType = (searchParams.get('serviceType') || '').trim();
    const moduleType = normalizeModuleType(serviceType);
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

    if (serviceType) (filter as Record<string, unknown>).serviceType = normalizeReferenceServiceType(serviceType);

    if (ids.length) {
      const applicationRows = await InvoicingApplication.find({
        $or: [{ _id: { $in: ids } }, { aiptReferenceId: { $in: ids } }],
      })
        .select('_id moduleType aiptReference applicationName markImage filingNumber classNo clientId countryId aiptReferenceId')
        .lean();
      return NextResponse.json({
        applications: applicationRows.map((row) => ({
          _id: String(row.aiptReferenceId || row._id),
          applicationId: String(row._id),
          referenceNo: row.aiptReference || '',
          countryId: row.countryId,
          serviceType: row.moduleType,
          applicationName: row.applicationName || '',
          filingNumber: row.filingNumber || '',
          classNo: row.classNo,
          markImage: row.markImage || '',
        })),
      });
    }

    const referenceRows = await ReferenceNumber.find(filter).sort({ referenceNo: 1 }).limit(500).lean();
    const referenceNos = referenceRows.map((row) => String(row.referenceNo || '').trim().toUpperCase()).filter(Boolean);
    const applicationRows = referenceNos.length
      ? await InvoicingApplication.find({
          aiptReference: { $in: referenceNos },
          ...(moduleType ? { moduleType } : {}),
          ...(clientId ? { clientId } : {}),
          ...(countryId ? { countryId } : {}),
        })
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
