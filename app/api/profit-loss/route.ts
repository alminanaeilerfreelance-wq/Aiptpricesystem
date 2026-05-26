import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClientQuotation from '@/models/ClientQuotation';
import AssociateQuotation from '@/models/AssociateQuotation';
import { getUserFromRequest } from '@/lib/auth';

const normalize = (value: string) => value.trim().toLowerCase();

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get('search') || '').trim();
    const pageParam = Number(searchParams.get('page') ?? '1');
    const limitParam = Number(searchParams.get('limit') ?? '10');
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 100) : 10;

    const [clientQuotations, associateQuotations] = await Promise.all([
      ClientQuotation.find({ isActive: true }).sort({ createdAt: -1 }).lean(),
      AssociateQuotation.find({ isActive: true }).sort({ createdAt: -1 }).lean(),
    ]);

    const associateByInquiry = new Map<string, typeof associateQuotations>();
    for (const associate of associateQuotations) {
      const key = normalize(associate.inquiryProject || '');
      if (!key) continue;
      if (!associateByInquiry.has(key)) associateByInquiry.set(key, []);
      associateByInquiry.get(key)!.push(associate);
    }

    const records: Array<{
      inquiryProject: string;
      clientQuotationId: string;
      clientQuotationNo: string;
      associateQuotationId: string;
      associateQuotationNo: string;
      clientQuotationTotal: number;
      associateQuotationTotal: number;
      profitOrLoss: number;
      status: 'Profit' | 'Loss' | 'Break-even';
      createdAt: string;
    }> = [];

    for (const client of clientQuotations) {
      const inquiries = Array.isArray(client.inquiryProjects) ? client.inquiryProjects : [];
      for (const inquiryProjectRaw of inquiries) {
        const inquiryProject = String(inquiryProjectRaw || '').trim();
        const key = normalize(inquiryProject);
        if (!key) continue;
        const associates = associateByInquiry.get(key) || [];
        for (const associate of associates) {
          const profitOrLoss = Number(client.grandTotal || 0) - Number(associate.grandTotal || 0);
          const status = profitOrLoss > 0 ? 'Profit' : profitOrLoss < 0 ? 'Loss' : 'Break-even';
          records.push({
            inquiryProject,
            clientQuotationId: String(client._id),
            clientQuotationNo: client.quotationNo,
            associateQuotationId: String(associate._id),
            associateQuotationNo: associate.quotationNo,
            clientQuotationTotal: Number(client.grandTotal || 0),
            associateQuotationTotal: Number(associate.grandTotal || 0),
            profitOrLoss,
            status,
            createdAt: new Date(
              Math.max(
                new Date(client.createdAt).getTime(),
                new Date(associate.createdAt).getTime()
              )
            ).toISOString(),
          });
        }
      }
    }

    const filteredRecords = search
      ? records.filter((record) =>
          record.inquiryProject.toLowerCase().includes(search.toLowerCase()) ||
          record.clientQuotationNo.toLowerCase().includes(search.toLowerCase()) ||
          record.associateQuotationNo.toLowerCase().includes(search.toLowerCase())
        )
      : records;

    filteredRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = filteredRecords.length;
    const start = (page - 1) * limit;
    const paginatedRecords = filteredRecords.slice(start, start + limit);

    const summary = filteredRecords.reduce(
      (acc, record) => {
        if (record.profitOrLoss > 0) acc.totalProfit += record.profitOrLoss;
        else if (record.profitOrLoss < 0) acc.totalLoss += Math.abs(record.profitOrLoss);
        acc.netTotal += record.profitOrLoss;
        return acc;
      },
      { totalProfit: 0, totalLoss: 0, netTotal: 0 }
    );

    return NextResponse.json({
      records: paginatedRecords,
      summary,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to calculate profit or loss', err), { status: 500 });
  }
}
