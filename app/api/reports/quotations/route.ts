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

    // --- By user (team performance) ---
    const byUserRaw = await Quotation.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creator',
        },
      },
      {
        $group: {
          _id: '$createdBy',
          name: { $first: { $arrayElemAt: ['$creator.name', 0] } },
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] },
          },
          draft: {
            $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    const byUser = byUserRaw.map((item) => ({
      userId: item._id?.toString() || '',
      name: item.name || 'Unknown',
      total: item.total,
      approved: item.approved,
      pending: item.pending,
      draft: item.draft,
    }));

    // --- Top clients by revenue ---
    const topClientsRaw = await Quotation.aggregate([
      {
        $match: { status: 'Approved' },
      },
      {
        $group: {
          _id: '$clientName',
          value: { $sum: '$total' },
        },
      },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ]);

    const topClients = topClientsRaw.map((item) => ({
      name: item._id,
      value: item.value,
    }));

    // --- Quotation age analysis (pending only) ---
    const now = new Date();
    const pendingQuotations = await Quotation.find({ status: 'Pending' });

    const ageAnalysis = {
      lessThan7Days: 0,
      days7to14: 0,
      days14to30: 0,
      moreThan30Days: 0,
    };

    pendingQuotations.forEach((q) => {
      const createdDate = new Date(q.createdAt);
      const daysOld = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOld < 7) ageAnalysis.lessThan7Days++;
      else if (daysOld < 14) ageAnalysis.days7to14++;
      else if (daysOld < 30) ageAnalysis.days14to30++;
      else ageAnalysis.moreThan30Days++;
    });

    // --- Amount distribution ---
    const allQuotations = await Quotation.find({});
    const amountBuckets: Record<string, number> = {
      '0-5K': 0,
      '5K-10K': 0,
      '10K-25K': 0,
      '25K-50K': 0,
      '50K+': 0,
    };

    allQuotations.forEach((q) => {
      if (q.total < 5000) amountBuckets['0-5K']++;
      else if (q.total < 10000) amountBuckets['5K-10K']++;
      else if (q.total < 25000) amountBuckets['10K-25K']++;
      else if (q.total < 50000) amountBuckets['25K-50K']++;
      else amountBuckets['50K+']++;
    });

    const amountDistribution = Object.entries(amountBuckets).map(([range, count]) => ({
      range,
      count,
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
      byUser,
      topClients,
      quotationAgeAnalysis: ageAnalysis,
      amountDistribution,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
