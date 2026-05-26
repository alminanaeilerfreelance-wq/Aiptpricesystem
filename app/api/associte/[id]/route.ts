import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Associte from '@/models/Associte';
import { getUserFromRequest } from '@/lib/auth';
import mongoose from 'mongoose';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUS = new Set(['Big', 'Small', 'New', 'Banned']);

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associte id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const associte = await Associte.findById(id).lean();

    if (!associte || !associte.isActive) {
      return NextResponse.json({ error: 'Associte not found' }, { status: 404 });
    }

    return NextResponse.json(associte);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch associte', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associte id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    if (body?.assignedId !== undefined && !String(body.assignedId).trim()) {
      return NextResponse.json({ error: 'Assigned ID cannot be empty' }, { status: 400 });
    }
    if (body?.associteName !== undefined && !String(body.associteName).trim()) {
      return NextResponse.json({ error: 'Associte Name cannot be empty' }, { status: 400 });
    }
    if (body?.status !== undefined && body.status && !VALID_STATUS.has(String(body.status))) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    if (body?.assignedId) {
      const duplicate = await Associte.findOne({
        _id: { $ne: id },
        assignedId: String(body.assignedId).trim(),
        isActive: true,
      }).lean();
      if (duplicate) {
        return NextResponse.json({ error: 'Assigned ID already exists' }, { status: 409 });
      }
    }

    const associte = await Associte.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true });
    if (!associte || !associte.isActive) {
      return NextResponse.json({ error: 'Associte not found' }, { status: 404 });
    }

    return NextResponse.json(associte);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to update associte', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associte id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();
    const associte = await Associte.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!associte) {
      return NextResponse.json({ error: 'Associte not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Associte deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete associte', err), { status: 500 });
  }
}
