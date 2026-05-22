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

    const approvedFilter = { status: 'Approved' };

    // --- Total revenue from Approved quotations ---
    const totalRevenueResult = await Quotation.aggregate([
      { $match: approvedFilter },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);

    const totalRevenue = totalRevenueResult[0]?.total ?? 0;

    // --- Monthly revenue for last 12 months (Approved only) ---
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenueRaw = await Quotation.aggregate([
      {
        $match: {
          ...approvedFilter,
          approvalDate: { $gte: twelveMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$approvalDate' },
            month: { $month: '$approvalDate' },
          },
          revenue: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    const monthlyRevenue = monthlyRevenueRaw.map((item) => ({
      month: `${item._id.year}-${String(item._id.month).padStart(2, '0')}`,
      revenue: item.revenue,
      count: item.count,
    }));

    // --- Top clients by revenue (Approved quotations) ---
    const topClientsRaw = await Quotation.aggregate([
      { $match: approvedFilter },
      {
        $group: {
          _id: '$clientId',
          clientName: { $first: '$clientName' },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    // Optionally enrich with populated client name if clientId exists
    const topClients = topClientsRaw.map((item) => ({
      clientId: item._id,
      clientName: item.clientName,
      total: item.total,
      count: item.count,
    }));

    // --- Top countries by revenue (Approved quotations) ---
    const topCountriesRaw = await Quotation.aggregate([
      { $match: approvedFilter },
      {
        $group: {
          _id: '$country',
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 10 },
    ]);

    const byCountry: Record<string, number> = {};
    for (const item of topCountriesRaw) {
      if (item._id) byCountry[item._id] = item.total;
    }

    // --- Top services by revenue (Approved quotations) ---
    const topServicesRaw = await Quotation.aggregate([
      { $match: approvedFilter },
      {
        $group: {
          _id: '$service',
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const byService: Record<string, number> = {};
    for (const item of topServicesRaw) {
      if (item._id) byService[item._id] = item.total;
    }

    // --- Pending revenue ---
    const pendingRevenueResult = await Quotation.aggregate([
      { $match: { status: 'Pending' } },
      { $group: { _id: null, total: { $sum: '$total' } } },
    ]);
    const pendingRevenue = pendingRevenueResult[0]?.total ?? 0;

    return NextResponse.json({
      totalRevenue,
      approvedRevenue: totalRevenue,
      pendingRevenue,
      byMonth: monthlyRevenue,
      byService,
      byCountry,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
