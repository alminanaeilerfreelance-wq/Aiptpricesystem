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
  classType?: 'single' | 'multi';
  numberOfClasses?: number;
  additionalFeePerClass?: number;
  officialFee?: number;
  attorneyFee?: number;
  officeFee?: number;
  otherFees?: number;
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

const calculateServices = (services: RawServiceItem[], serviceCategory: ServiceCategory) => {
  const isTrademark = serviceCategory === 'Trademark';
  const normalized = services.map((service) => {
    const classType = isTrademark && service.classType === 'multi' ? 'multi' : 'single';
    const officialFee = Math.max(0, toNumber(service.officialFee));
    const attorneyFee = Math.max(0, toNumber(service.attorneyFee));
    const officeFee = Math.max(0, toNumber(service.officeFee));
    const otherFees = Math.max(0, toNumber(service.otherFees));
    const discount = Math.max(0, toNumber(service.discount));
    const numberOfClasses = classType === 'multi' ? Math.max(1, Math.floor(toNumber(service.numberOfClasses, 1))) : 1;
    const additionalFeePerClass = classType === 'multi' ? Math.max(0, toNumber(service.additionalFeePerClass)) : 0;
    const additionalClassFees = classType === 'multi' ? additionalFeePerClass * numberOfClasses : 0;
    const totalOfficialFees = officialFee + additionalClassFees;
    const totalAmount = totalOfficialFees + attorneyFee + officeFee + otherFees;
    const grandTotal = Math.max(0, totalAmount - discount);

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
      discount,
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
      acc.totalDiscount += item.discount;
      acc.grandTotal += item.grandTotal;
      return acc;
    },
    {
      totalOfficialFees: 0,
      totalAttorneyFees: 0,
      totalOfficeFees: 0,
      totalOtherFees: 0,
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
      const inquiry = await Inquire.findOne({ _id: body.inquiryId, isActive: true })
        .populate({ path: 'serviceId', select: 'category', strictPopulate: false })
        .populate({ path: 'procedureId', select: 'name', strictPopulate: false })
        .populate({ path: 'countryIds', select: 'name', strictPopulate: false })
        .lean();
      if (!inquiry) return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
      const serviceCategory = (inquiry.serviceId as any)?.category as ServiceCategory;
      updatePayload.inquiryId = inquiry._id;
      updatePayload.inquiryProjects = [String(inquiry.referenceNo || '').trim()];
      updatePayload.serviceCategory = serviceCategory;
      updatePayload.inquirySnapshot = {
        referenceNo: inquiry.referenceNo,
        procedureName: (inquiry.procedureId as any)?.name || '',
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
      if (body.services.some((service: RawServiceItem) => !String(service?.procedureName || '').trim())) {
        return NextResponse.json({ error: 'Procedure name is required for all service rows' }, { status: 400 });
      }
      const serviceCategory = (updatePayload.serviceCategory || existing.serviceCategory || 'Trademark') as ServiceCategory;
      const { normalized, totals } = calculateServices(body.services, serviceCategory);
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
