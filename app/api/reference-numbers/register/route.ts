import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import Client from '@/models/Client';
import ReferenceNumber from '@/models/ReferenceNumber';
import { getUserFromRequest } from '@/lib/auth';

interface ReferenceRegistrationInput {
  referenceNo?: string;
  countryId?: string;
  countryName?: string;
  countryCode?: string;
  serviceType?: string;
  serviceCode?: string;
  sequence?: number;
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();

    const body = await req.json();
    const references: ReferenceRegistrationInput[] = Array.isArray(body?.references) ? body.references : [];
    const usedBy = String(body?.usedBy || '').trim();

    if (references.length === 0) {
      return NextResponse.json({ error: 'No generated references to register' }, { status: 400 });
    }
    if (references.length > 1000) {
      return NextResponse.json({ error: 'Maximum 1000 references can be registered at once' }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(usedBy)) {
      return NextResponse.json({ error: 'Client owner is required before registering references' }, { status: 400 });
    }
    const ownerClient = await Client.findById(usedBy).select('_id').lean();
    if (!ownerClient) {
      return NextResponse.json({ error: 'Client owner was not found' }, { status: 404 });
    }

    const referenceNos = references.map((item) => String(item?.referenceNo || '').trim().toUpperCase()).filter(Boolean);
    if (referenceNos.length !== references.length) {
      return NextResponse.json({ error: 'Every reference must include a reference number' }, { status: 400 });
    }

    const existing = await ReferenceNumber.find({ referenceNo: { $in: referenceNos } }).select('referenceNo').lean();
    if (existing.length > 0) {
      return NextResponse.json(
        { error: `Duplicate reference numbers already exist: ${existing.map((item) => item.referenceNo).join(', ')}` },
        { status: 409 }
      );
    }

    const createdBy = mongoose.Types.ObjectId.isValid(user.userId) ? new mongoose.Types.ObjectId(user.userId) : undefined;
    const usedByObjectId = new mongoose.Types.ObjectId(usedBy);
    const docs = references.map((item) => ({
      referenceNo: String(item.referenceNo || '').trim().toUpperCase(),
      countryId: item.countryId,
      countryName: String(item.countryName || '').trim(),
      countryCode: String(item.countryCode || '').trim().toUpperCase(),
      serviceType: item.serviceType,
      serviceCode: String(item.serviceCode || '').trim().toUpperCase(),
      sequence: Number(item.sequence),
      status: 'Reserved',
      usedBy: usedByObjectId,
      ...(createdBy ? { createdBy } : {}),
    }));

    const registered = await ReferenceNumber.insertMany(docs, { ordered: true });
    return NextResponse.json({ registered, count: registered.length }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register reference numbers';
    const status = message.includes('duplicate key') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
