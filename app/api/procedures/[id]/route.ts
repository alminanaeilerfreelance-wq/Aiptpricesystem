import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Procedure from '@/models/Procedure';
import Service from '@/models/Service';
import { getUserFromRequest } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const procedure = await Procedure.findById(id);
    if (!procedure) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    }

    return NextResponse.json(procedure);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const body = await req.json();
    const existing = await Procedure.findById(id);
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    }

    const finalName =
      body?.name !== undefined ? String(body.name || '').trim() : String(existing.name || '');
    const finalServiceId =
      body?.serviceId !== undefined
        ? String(body.serviceId || '').trim()
        : String(existing.serviceId || '');

    if (!finalName) {
      return NextResponse.json({ error: 'Procedure name is required' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(finalServiceId)) {
      return NextResponse.json({ error: 'Valid service is required' }, { status: 400 });
    }

    const service = await Service.findOne({ _id: finalServiceId, isActive: true }).lean();

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const procedure = await Procedure.findByIdAndUpdate(
      id,
      {
        $set: {
          name: finalName,
          serviceId: finalServiceId,
          serviceName: service.name,
          serviceCategory: service.category,
          isActive: body?.isActive !== undefined ? body.isActive !== false : existing.isActive,
        },
      },
      { new: true, runValidators: true }
    );

    if (!procedure) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    }

    return NextResponse.json(procedure);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    const user = getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    const procedure = await Procedure.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );

    if (!procedure) {
      return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Procedure deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Operation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
