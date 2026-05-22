import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // --- Totals by status ---
    const statusCounts = await Quotation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
    ]);

    const statusMap: Record<string, { count: number; value: number }> = {};
    let totalQuotations = 0;
    let totalValue = 0;

    for (const item of statusCounts) {
      statusMap[item._id] = { count: item.count, value: item.value };
      totalQuotations += item.count;
      totalValue += item.value;
    }

    const approvedCount = statusMap['Approved']?.count ?? 0;
    const pendingCount = statusMap['Pending']?.count ?? 0;
    const draftCount = statusMap['Draft']?.count ?? 0;
    const rejectedCount = statusMap['Rejected']?.count ?? 0;

    // --- By service ---
    const byServiceRaw = await Quotation.aggregate([
      {
        $group: {
          _id: '$service',
          count: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    const byService = byServiceRaw.map((item) => ({
      service: item._id,
      count: item.count,
      value: item.value,
    }));

    // --- By country ---
    const byCountryRaw = await Quotation.aggregate([
      {
        $group: {
          _id: '$country',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    const byCountry = byCountryRaw.map((item) => ({
      country: item._id,
      count: item.count,
    }));

    // --- Monthly for last 12 months ---
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRaw = await Quotation.aggregate([
      {
        $match: { createdAt: { $gte: twelveMonthsAgo } },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          value: { $sum: '$total' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthly = monthlyRaw.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      count: item.count,
      value: item.value,
    }));

    return NextResponse.json({
      total: totalQuotations,
      approved: approvedCount,
      pending: pendingCount,
      draft: draftCount,
      rejected: rejectedCount,
      totalValue,
      byService,
      byCountry,
      monthly,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
