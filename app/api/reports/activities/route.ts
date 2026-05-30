import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Quotation from '@/models/Quotation';
import User from '@/models/User';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    await connectDB();

    // Get recent quotations with creator info
    const recentQuotations = await Quotation.find()
      .select('_id quotationNo status createdBy createdAt approvedBy approvalDate')
      .populate('createdBy', 'name')
      .populate('approvedBy', 'name')
      .sort({ createdAt: -1, approvalDate: -1 })
      .limit(limit)
      .lean();

    // Format into activities
    const activities = recentQuotations.flatMap((q: any) => {
      const result = [];

      // Creation activity
      if (q.createdBy) {
        result.push({
          _id: `${q._id}-created`,
          userId: q.createdBy._id?.toString() || '',
          userName: q.createdBy.name || 'Unknown',
          action: 'Created',
          quotationNo: q.quotationNo,
          quotationId: q._id?.toString(),
          timestamp: q.createdAt,
          details: `Quotation created with status: ${q.status}`,
        });
      }

      // Approval/rejection activity
      if (q.approvalDate && q.approvedBy && q.status !== 'Draft' && q.status !== 'Pending') {
        result.push({
          _id: `${q._id}-${q.status.toLowerCase()}`,
          userId: q.approvedBy._id?.toString() || '',
          userName: q.approvedBy.name || 'Unknown',
          action: q.status === 'Approved' ? 'Approved' : 'Rejected',
          quotationNo: q.quotationNo,
          quotationId: q._id?.toString(),
          timestamp: q.approvalDate,
          details: `Quotation ${q.status.toLowerCase()}`,
        });
      }

      return result;
    });

    // Sort by timestamp descending and take limit
    const sortedActivities = activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return NextResponse.json(sortedActivities);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
