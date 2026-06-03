import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import ClientQuotation from '@/models/ClientQuotation';
import Client from '@/models/Client';
import Inquire from '@/models/Inquire';
import Requirement from '@/models/Requirement';
import { getUserFromRequest } from '@/lib/auth';

type ServiceCategory = 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface RawServiceItem {
  procedureId?: string;
  procedureName?: string;
  countryName?: string;
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
      countryName: String(service.countryName || '').trim(),
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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const clientQuotation = await ClientQuotation.findById(id)
      .populate({ path: 'clientId', select: 'name email type country phone', strictPopulate: false })
      .populate({ path: 'inquiryId', select: 'referenceNo', strictPopulate: false })
      .populate({ path: 'requirementId', select: 'requirements country', strictPopulate: false })
      .lean();

    if (!clientQuotation || !clientQuotation.isActive) {
      return NextResponse.json({ error: 'Client quotation not found' }, { status: 404 });
    }

    return NextResponse.json(clientQuotation);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch client quotation', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const body = await req.json();
    const updatePayload: Record<string, any> = {};

    const existing = await ClientQuotation.findById(id).lean();
    if (!existing || !existing.isActive) {
      return NextResponse.json({ error: 'Client quotation not found' }, { status: 404 });
    }

    if (body?.status !== undefined) {
      if (!VALID_STATUS.has(String(body.status))) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updatePayload.status = body.status;
    }

    if (typeof body?.clientId === 'string') {
      if (!mongoose.Types.ObjectId.isValid(body.clientId)) return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
      const client = await Client.findOne({ _id: body.clientId, isActive: true }).lean();
      if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
      updatePayload.clientId = client._id;
      updatePayload.clientSnapshot = {
        name: client.name,
        email: client.email,
        type: client.type,
        country: client.country,
        phone: client.phone,
      };
    }

    if (typeof body?.inquiryId === 'string') {
      if (!mongoose.Types.ObjectId.isValid(body.inquiryId)) return NextResponse.json({ error: 'Invalid inquiryId' }, { status: 400 });
      const existingInquiryQuotation = await ClientQuotation.findOne({
        _id: { $ne: id },
        inquiryId: body.inquiryId,
        isActive: true,
      }).lean();
      if (existingInquiryQuotation) {
        return NextResponse.json(
          { error: 'This inquiry project already has a client quotation' },
          { status: 409 }
        );
      }
      const inquiry = await Inquire.findOne({ _id: body.inquiryId, isActive: { $ne: false } })
        .populate({ path: 'serviceId', select: 'category', strictPopulate: false })
        .populate({ path: 'procedureId', select: 'name', strictPopulate: false })
        .populate({ path: 'procedureIds', select: 'name', strictPopulate: false })
        .populate({ path: 'countryIds', select: 'name', strictPopulate: false })
        .lean();
      if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
      const serviceCategory = (inquiry.serviceId as any)?.category as ServiceCategory;
      updatePayload.inquiryId = inquiry._id;
      updatePayload.inquiryProjects = [String(inquiry.referenceNo || '').trim()];
      updatePayload.serviceCategory = serviceCategory;
      updatePayload.inquirySnapshot = {
        referenceNo: inquiry.referenceNo,
        procedureName: getInquiryProcedureName(inquiry),
        countryNames: Array.isArray(inquiry.countryIds) ? inquiry.countryIds.map((c: any) => c?.name).filter(Boolean) : [],
        serviceCategory,
      };
    }

    if (typeof body?.requirementId === 'string') {
      if (!mongoose.Types.ObjectId.isValid(body.requirementId)) return NextResponse.json({ error: 'Invalid requirementId' }, { status: 400 });
      const requirement: any = await Requirement.findById(body.requirementId).populate({ path: 'country', select: 'name' }).lean();
      if (!requirement) return NextResponse.json({ error: 'Requirement not found' }, { status: 404 });
      updatePayload.requirementId = requirement._id;
      updatePayload.requirementSnapshot = {
        countryName: (requirement.country as any)?.name || '',
        requirements: requirement.requirements || '',
      };
    }

    if (Array.isArray(body?.services)) {
      if (body.services.length === 0) return NextResponse.json({ error: 'At least one service row is required' }, { status: 400 });
      const validationErrors = validateServiceRows(body.services);
      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: 'Invalid fee values',
            details: validationErrors,
          },
          { status: 400 }
        );
      }
      const serviceCategory = (updatePayload.serviceCategory || existing.serviceCategory || 'Trademark') as ServiceCategory;
      const { normalized, totals } = calculateServices(body.services);
      updatePayload.services = normalized;
      Object.assign(updatePayload, totals);
    }

    const clientQuotation = await ClientQuotation.findByIdAndUpdate(id, { $set: updatePayload }, { new: true, runValidators: true })
      .populate({ path: 'clientId', select: 'name email type country phone', strictPopulate: false });

    return NextResponse.json(clientQuotation);
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid client quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to update client quotation', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid client quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const clientQuotation = await ClientQuotation.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!clientQuotation) {
      return NextResponse.json({ error: 'Client quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Client quotation deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete client quotation', err), { status: 500 });
  }
}
