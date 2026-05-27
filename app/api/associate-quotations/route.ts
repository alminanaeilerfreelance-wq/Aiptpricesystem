import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import AssociateQuotation from '@/models/AssociateQuotation';
import Associte from '@/models/Associte';
import Inquire from '@/models/Inquire';
import { getUserFromRequest } from '@/lib/auth';
import {
  ASSOCIATE_QUOTATION_SERVICE_CATEGORIES,
  generateAssociateQuotationNo,
  isAssociateQuotationServiceCategory,
  resolveCountryAbbreviationFromValue,
} from '@/lib/associate-quotation-number';

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

const getInquiryProcedureName = (inquiry: any): string => {
  if (Array.isArray(inquiry?.procedureIds) && inquiry.procedureIds.length > 0) {
    const names = inquiry.procedureIds
      .map((procedure: any) => procedure?.name || '')
      .filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return inquiry?.procedureId?.name || '';
};

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
        { serviceCategory: { $regex: safeSearch, $options: 'i' } },
        { countryAbbreviation: { $regex: safeSearch, $options: 'i' } },
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
    const serviceCategoryRaw = String(body?.serviceCategory || '').trim();
    let inquiryId: mongoose.Types.ObjectId | undefined;
    let inquirySnapshot: { referenceNo?: string; procedureName?: string; countryNames?: string[] } | undefined;
    if (typeof body?.inquiryId === 'string' && mongoose.Types.ObjectId.isValid(body.inquiryId)) {
      inquiryId = new mongoose.Types.ObjectId(body.inquiryId);
      const inquiry: any = await Inquire.findOne({ _id: inquiryId, isActive: { $ne: false } })
        .populate({ path: 'procedureId', select: 'name', strictPopulate: false })
        .populate({ path: 'procedureIds', select: 'name', strictPopulate: false })
        .populate({ path: 'countryIds', select: 'name', strictPopulate: false })
        .lean();
      if (inquiry) {
        inquirySnapshot = {
          referenceNo: inquiry.referenceNo,
          procedureName: getInquiryProcedureName(inquiry),
          countryNames: Array.isArray(inquiry.countryIds) ? inquiry.countryIds.map((c: any) => c?.name).filter(Boolean) : [],
        };
      }
    }

    if (!isAssociateQuotationServiceCategory(serviceCategoryRaw)) {
      return NextResponse.json(
        {
          error: `Service category is required and must be one of: ${ASSOCIATE_QUOTATION_SERVICE_CATEGORIES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

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

    if (!body?.associateId) {
      return NextResponse.json({ error: 'Associate is required' }, { status: 400 });
    }
    if (typeof body.associateId !== 'string' || !mongoose.Types.ObjectId.isValid(body.associateId)) {
      return NextResponse.json({ error: 'Invalid associateId' }, { status: 400 });
    }

    const associateId = new mongoose.Types.ObjectId(body.associateId);
    const associte = await Associte.findById(associateId).lean();
    if (!associte || !associte.isActive) {
      return NextResponse.json({ error: 'Associate not found' }, { status: 404 });
    }

    const countryAbbreviation = await resolveCountryAbbreviationFromValue(associte.country);
    if (!countryAbbreviation) {
      return NextResponse.json(
        { error: 'Associate country is required to generate quotation reference number' },
        { status: 400 }
      );
    }

    const quotationNo = await generateAssociateQuotationNo({
      serviceCategory: serviceCategoryRaw,
      countryAbbreviation,
    });

    const associateSnapshot = {
      associteName: associte.associteName,
      email: associte.email,
      associteType: associte.associteType,
      contact: associte.contact,
      address: associte.address,
      country: associte.country,
      notes: associte.notes,
    };

    const associateQuotation = await AssociateQuotation.create({
      quotationNo,
      serviceCategory: serviceCategoryRaw,
      countryAbbreviation,
      associateId,
      associateSnapshot,
      inquiryProject,
      inquiryId,
      inquirySnapshot,
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
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err as any).code === 11000
    ) {
      return NextResponse.json(
        { error: 'Duplicate quotation reference generated. Please retry.' },
        { status: 409 }
      );
    }
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid associate quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to create associate quotation', err), { status: 500 });
  }
}
