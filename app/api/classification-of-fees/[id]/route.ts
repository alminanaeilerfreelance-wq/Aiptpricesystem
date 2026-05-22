import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import ClassificationOfFee from '@/models/ClassificationOfFee';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const classificationOfFee = await ClassificationOfFee.findById(params.id);
    if (!classificationOfFee) {
      return NextResponse.json({ error: 'Classification of fee not found' }, { status: 404 });
    }

    return NextResponse.json(classificationOfFee);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const classificationOfFee = await ClassificationOfFee.findByIdAndUpdate(
      params.id,
      { $set: body },
      { new: true, runValidators: true }
    );

    if (!classificationOfFee) {
      return NextResponse.json({ error: 'Classification of fee not found' }, { status: 404 });
    }

    return NextResponse.json(classificationOfFee);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const classificationOfFee = await ClassificationOfFee.findByIdAndUpdate(
      params.id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!classificationOfFee) {
      return NextResponse.json({ error: 'Classification of fee not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Classification of fee deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
