import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import AssociateQuotation from '@/models/AssociateQuotation';
import Associte from '@/models/Associte';
import { getUserFromRequest } from '@/lib/auth';

interface RawServiceItem {
  procedureId?: string;
  procedureName?: string;
  classType?: 'single' | 'multi';
  numberOfClasses?: number;
  additionalFeePerClass?: number;
  officialFee?: number;
  attorneyFee?: number;
  officeFee?: number;
  otherFees?: number;
}

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toErrorPayload = (fallback: string, err: unknown) => {
  const message = err instanceof Error ? err.message : fallback;
  return { error: fallback, details: message };
};

const VALID_STATUS = new Set(['Draft', 'Submitted', 'Approved', 'Rejected']);

const calculateServices = (services: RawServiceItem[]) => {
  const normalized = services.map((service) => {
    const classType = service.classType === 'multi' ? 'multi' : 'single';
    const officialFee = Math.max(0, toNumber(service.officialFee));
    const attorneyFee = Math.max(0, toNumber(service.attorneyFee));
    const officeFee = Math.max(0, toNumber(service.officeFee));
    const otherFees = Math.max(0, toNumber(service.otherFees));
    const numberOfClasses = classType === 'multi' ? Math.max(1, Math.floor(toNumber(service.numberOfClasses, 1))) : 1;
    const additionalFeePerClass = classType === 'multi' ? Math.max(0, toNumber(service.additionalFeePerClass)) : 0;
    const additionalClassFees = classType === 'multi' ? additionalFeePerClass * numberOfClasses : 0;
    const totalOfficialFees = officialFee + additionalClassFees;
    const totalAmount = totalOfficialFees + attorneyFee + officeFee + otherFees;
    const grandTotal = totalAmount;

    return {
      procedureId:
        typeof service.procedureId === 'string' && mongoose.Types.ObjectId.isValid(service.procedureId)
          ? new mongoose.Types.ObjectId(service.procedureId)
          : undefined,
      procedureName: String(service.procedureName || '').trim(),
      classType,
      numberOfClasses,
      additionalFeePerClass,
      officialFee,
      additionalClassFees,
      totalOfficialFees,
      attorneyFee,
      officeFee,
      otherFees,
      totalAmount,
      grandTotal,
    };
  });

  const totals = normalized.reduce(
    (acc, item) => {
      acc.totalOfficialFees += item.totalOfficialFees;
      acc.totalAttorneyFees += item.attorneyFee;
      acc.totalOfficeFees += item.officeFee;
      acc.totalOtherFees += item.otherFees;
      acc.grandTotal += item.grandTotal;
      return acc;
    },
    {
      totalOfficialFees: 0,
      totalAttorneyFees: 0,
      totalOfficeFees: 0,
      totalOtherFees: 0,
      grandTotal: 0,
    }
  );

  return { normalized, totals };
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
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { isActive: true };
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { quotationNo: { $regex: safeSearch, $options: 'i' } },
        { inquiryProject: { $regex: safeSearch, $options: 'i' } },
        { 'associateSnapshot.associteName': { $regex: safeSearch, $options: 'i' } },
        { 'associateSnapshot.email': { $regex: safeSearch, $options: 'i' } },
        { 'services.procedureName': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [associateQuotations, total] = await Promise.all([
      AssociateQuotation.find(filter)
        .populate({ path: 'associateId', select: 'associteName email associteType contact address notes', strictPopulate: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AssociateQuotation.countDocuments(filter),
    ]);

    return NextResponse.json({
      associateQuotations,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load associate quotations', err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const inquiryProject = String(body?.inquiryProject || '').trim();

    if (!inquiryProject) {
      return NextResponse.json({ error: 'Inquiry project is required' }, { status: 400 });
    }

    const services: RawServiceItem[] = Array.isArray(body?.services) ? body.services : [];
    if (services.length === 0) {
      return NextResponse.json({ error: 'At least one service row is required' }, { status: 400 });
    }
    if (services.some((service) => !String(service?.procedureName || '').trim())) {
      return NextResponse.json({ error: 'Procedure name is required for all service rows' }, { status: 400 });
    }

    const { normalized, totals } = calculateServices(services);

    if (body?.status !== undefined && !VALID_STATUS.has(String(body.status))) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }

    let associateSnapshot: any = undefined;
    let associateId: mongoose.Types.ObjectId | undefined;

    if (body?.associateId !== undefined && body.associateId !== null && body.associateId !== '') {
      if (typeof body.associateId !== 'string' || !mongoose.Types.ObjectId.isValid(body.associateId)) {
        return NextResponse.json({ error: 'Invalid associateId' }, { status: 400 });
      }
      associateId = new mongoose.Types.ObjectId(body.associateId);
      const associte = await Associte.findById(associateId).lean();
      if (associte && associte.isActive) {
        associateSnapshot = {
          associteName: associte.associteName,
          email: associte.email,
          associteType: associte.associteType,
          contact: associte.contact,
          address: associte.address,
          notes: associte.notes,
        };
      }
    }

    const associateQuotation = await AssociateQuotation.create({
      associateId,
      associateSnapshot,
      inquiryProject,
      services: normalized,
      ...totals,
      status: body?.status || 'Draft',
    });

    const populated = await associateQuotation.populate({
      path: 'associateId',
      select: 'associteName email associteType contact address notes',
      strictPopulate: false,
    });

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid associate quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to create associate quotation', err), { status: 500 });
  }
}
