import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import ClientQuotation from '@/models/ClientQuotation';
import Client from '@/models/Client';
import Inquire from '@/models/Inquire';
import Requirement from '@/models/Requirement';
import { getUserFromRequest } from '@/lib/auth';

type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

interface RawServiceItem {
  procedureId?: string;
  procedureName?: string;
  classType?: 'single' | 'multi';
  numberOfClasses?: number;
  additionalFeePerClass?: number;
  officialFee?: number;
  attorneyFee?: number;
  otherFees?: number;
  vatFee?: number; // VAT percent
  discount?: number;
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
const APPROVAL_STATUS = new Set(['Approved', 'Rejected']);

const getInquiryProcedureName = (inquiry: any): string => {
  if (Array.isArray(inquiry?.procedureIds) && inquiry.procedureIds.length > 0) {
    const names = inquiry.procedureIds
      .map((procedure: any) => procedure?.name || '')
      .filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  return inquiry?.procedureId?.name || '';
};

const parseOptionalNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateServiceRows = (services: RawServiceItem[]): string[] => {
  const errors: string[] = [];

  services.forEach((service, index) => {
    const row = `Service row ${index + 1}`;
    const classType = service.classType === 'multi' ? 'multi' : 'single';
    const officialFee = parseOptionalNumber(service.officialFee);
    const attorneyFee = parseOptionalNumber(service.attorneyFee);
    const discount = parseOptionalNumber(service.discount);
    const vat = parseOptionalNumber(service.vatFee);
    const numberOfClasses = parseOptionalNumber(service.numberOfClasses);
    const additionalFeePerClass = parseOptionalNumber(service.additionalFeePerClass);

    if (!String(service?.procedureName || '').trim()) {
      errors.push(`${row}: Procedure is required.`);
    }

    if (officialFee === null) errors.push(`${row}: Official Fee is required and must be a number.`);
    else if (officialFee < 0) errors.push(`${row}: Official Fee cannot be negative.`);

    if (attorneyFee === null) errors.push(`${row}: Attorney Fee is required and must be a number.`);
    else if (attorneyFee < 0) errors.push(`${row}: Attorney Fee cannot be negative.`);

    if (discount !== null) {
      if (discount < 0) errors.push(`${row}: Discount cannot be negative.`);
      if (attorneyFee !== null && discount > attorneyFee) {
        errors.push(`${row}: Discount cannot be greater than Attorney Fee.`);
      }
    }

    if (vat !== null) {
      if (vat < 0) errors.push(`${row}: VAT cannot be negative.`);
      if (vat > 100) errors.push(`${row}: VAT cannot be greater than 100.`);
    }

    if (classType === 'multi') {
      if (numberOfClasses === null || numberOfClasses < 1) {
        errors.push(`${row}: Number of Classes is required for multi class and must be at least 1.`);
      }
      if (additionalFeePerClass === null || additionalFeePerClass < 0) {
        errors.push(`${row}: Additional Fee Per Class is required for multi class and cannot be negative.`);
      }
    }
  });

  return errors;
};

const calculateServices = (services: RawServiceItem[]) => {
  const normalized = services.map((service) => {
    const classType = service.classType === 'multi' ? 'multi' : 'single';
    const numberOfClasses =
      classType === 'multi' ? Math.max(1, Math.floor(toNumber(service.numberOfClasses, 1))) : 1;
    const additionalFeePerClass =
      classType === 'multi' ? Math.max(0, toNumber(service.additionalFeePerClass)) : 0;
    const additionalClassFees = additionalFeePerClass * numberOfClasses;
    const officialFee = Math.max(0, toNumber(service.officialFee));
    const attorneyFee = Math.max(0, toNumber(service.attorneyFee));
    const otherFees = Math.max(0, toNumber(service.otherFees));
    const discount = Math.max(0, toNumber(service.discount));
    const vatPercent = Math.max(0, toNumber(service.vatFee));
    const totalOfficialFees = officialFee + (classType === 'multi' ? additionalClassFees : 0);
    const attorneyFeeAfterDiscount = attorneyFee - discount;
    const vatAmount = attorneyFeeAfterDiscount * (vatPercent / 100);
    const totalAmount = totalOfficialFees + attorneyFeeAfterDiscount + vatAmount;
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
      officeFee: 0,
      otherFees,
      vatFee: vatPercent,
      discount,
      totalAmount,
      grandTotal,
    };
  });

  const totals = normalized.reduce(
    (acc, item) => {
      const vatAmount = (item.attorneyFee - item.discount) * (item.vatFee / 100);
      acc.totalOfficialFees += item.totalOfficialFees;
      acc.totalAttorneyFees += item.attorneyFee;
      acc.totalOfficeFees += 0;
      acc.totalOtherFees += item.otherFees;
      acc.totalVatFees += vatAmount;
      acc.totalDiscount += item.discount;
      acc.grandTotal += item.totalAmount;
      return acc;
    },
    {
      totalOfficialFees: 0,
      totalAttorneyFees: 0,
      totalOfficeFees: 0,
      totalOtherFees: 0,
      totalVatFees: 0,
      totalDiscount: 0,
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

    const filter: Record<string, any> = { isActive: true };
    if (search) {
      const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { quotationNo: { $regex: safeSearch, $options: 'i' } },
        { inquiryProjects: { $regex: safeSearch, $options: 'i' } },
        { serviceCategory: { $regex: safeSearch, $options: 'i' } },
        { 'clientSnapshot.name': { $regex: safeSearch, $options: 'i' } },
        { 'services.procedureName': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [clientQuotations, total] = await Promise.all([
      ClientQuotation.find(filter)
        .populate({ path: 'clientId', select: 'name email type country phone', strictPopulate: false })
        .populate({ path: 'inquiryId', select: 'referenceNo', strictPopulate: false })
        .populate({ path: 'requirementId', select: 'requirements country', strictPopulate: false })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ClientQuotation.countDocuments(filter),
    ]);

    return NextResponse.json({
      clientQuotations,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to load client quotations', err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();

    if (typeof body?.clientId !== 'string' || !mongoose.Types.ObjectId.isValid(body.clientId)) {
      return NextResponse.json({ error: 'Client is required' }, { status: 400 });
    }
    if (typeof body?.inquiryId !== 'string' || !mongoose.Types.ObjectId.isValid(body.inquiryId)) {
      return NextResponse.json({ error: 'Inquiry project is required' }, { status: 400 });
    }

    const [client, inquiry] = await Promise.all([
      Client.findOne({ _id: body.clientId, isActive: true }).lean(),
      Inquire.findOne({ _id: body.inquiryId, isActive: { $ne: false } })
        .populate({ path: 'serviceId', select: 'category', strictPopulate: false })
        .populate({ path: 'procedureId', select: 'name', strictPopulate: false })
        .populate({ path: 'procedureIds', select: 'name', strictPopulate: false })
        .populate({ path: 'countryIds', select: 'name', strictPopulate: false })
        .lean(),
    ]);

    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });

    const existingInquiryQuotation = await ClientQuotation.findOne({
      inquiryId: body.inquiryId,
      isActive: true,
    }).lean();
    if (existingInquiryQuotation) {
      return NextResponse.json(
        { error: 'This inquiry project already has a client quotation' },
        { status: 409 }
      );
    }

    const serviceCategory = (inquiry.serviceId as any)?.category as ServiceCategory;
    if (!serviceCategory) {
      return NextResponse.json({ error: 'Inquiry service category is missing' }, { status: 400 });
    }

    const services: RawServiceItem[] = Array.isArray(body?.services) ? body.services : [];
    if (services.length === 0) {
      return NextResponse.json({ error: 'At least one service row is required' }, { status: 400 });
    }
    const validationErrors = validateServiceRows(services);
    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid fee values',
          details: validationErrors,
        },
        { status: 400 }
      );
    }

    const { normalized, totals } = calculateServices(services);

    if (body?.status !== undefined) {
      if (!VALID_STATUS.has(String(body.status))) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
    }

    let requirementId: mongoose.Types.ObjectId | undefined;
    let requirementSnapshot: { countryName?: string; requirements?: string } | undefined;
    if (typeof body?.requirementId === 'string' && mongoose.Types.ObjectId.isValid(body.requirementId)) {
      requirementId = new mongoose.Types.ObjectId(body.requirementId);
      const requirement: any = await Requirement.findById(requirementId).populate({ path: 'country', select: 'name' }).lean();
      if (requirement) {
        requirementSnapshot = {
          countryName: (requirement.country as any)?.name || '',
          requirements: requirement.requirements || '',
        };
      }
    }

    const clientQuotation = await ClientQuotation.create({
      clientId: client._id,
      clientSnapshot: {
        name: client.name,
        email: client.email,
        type: client.type,
        country: client.country,
        phone: client.phone,
      },
      inquiryId: inquiry._id,
      inquirySnapshot: {
        referenceNo: inquiry.referenceNo,
        procedureName: getInquiryProcedureName(inquiry),
        countryNames: Array.isArray(inquiry.countryIds) ? inquiry.countryIds.map((c: any) => c?.name).filter(Boolean) : [],
        serviceCategory,
      },
      requirementId,
      requirementSnapshot,
      inquiryProjects: [String(inquiry.referenceNo || '').trim()],
      serviceCategory,
      services: normalized,
      ...totals,
      status: body?.status || 'Submitted',
    });

    const populated = await clientQuotation.populate([
      { path: 'clientId', select: 'name email type country phone', strictPopulate: false },
      { path: 'inquiryId', select: 'referenceNo', strictPopulate: false },
      { path: 'requirementId', select: 'requirements country', strictPopulate: false },
    ]);

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid client quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to create client quotation', err), { status: 500 });
  }
}
