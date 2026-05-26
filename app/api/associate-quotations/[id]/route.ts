import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import AssociateQuotation from '@/models/AssociateQuotation';
import Associte from '@/models/Associte';
import { getUserFromRequest } from '@/lib/auth';
import {
  ASSOCIATE_QUOTATION_SERVICE_CATEGORIES,
  generateAssociateQuotationNo,
  isAssociateQuotationServiceCategory,
  resolveCountryAbbreviationFromValue,
} from '@/lib/associate-quotation-number';

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

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associate quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const associateQuotation = await AssociateQuotation.findById(id)
      .populate({ path: 'associateId', select: 'associteName email associteType contact address notes', strictPopulate: false })
      .lean();

    if (!associateQuotation || !associateQuotation.isActive) {
      return NextResponse.json({ error: 'Associate quotation not found' }, { status: 404 });
    }

    return NextResponse.json(associateQuotation);
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to fetch associate quotation', err), { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associate quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const existingQuotation = await AssociateQuotation.findById(id).lean();
    if (!existingQuotation || !existingQuotation.isActive) {
      return NextResponse.json({ error: 'Associate quotation not found' }, { status: 404 });
    }

    const body = await req.json();
    const updatePayload: Record<string, any> = {};

    if (body?.inquiryProject !== undefined) {
      const inquiryProject = String(body.inquiryProject || '').trim();
      if (!inquiryProject) {
        return NextResponse.json({ error: 'Inquiry project is required' }, { status: 400 });
      }
      updatePayload.inquiryProject = inquiryProject;
    }

    if (Array.isArray(body?.services)) {
      if (body.services.length === 0) {
        return NextResponse.json({ error: 'At least one service row is required' }, { status: 400 });
      }
      if (body.services.some((service: RawServiceItem) => !String(service?.procedureName || '').trim())) {
        return NextResponse.json({ error: 'Procedure name is required for all service rows' }, { status: 400 });
      }
      const { normalized, totals } = calculateServices(body.services);
      updatePayload.services = normalized;
      Object.assign(updatePayload, totals);
    }

    if (body?.status !== undefined) {
      if (!VALID_STATUS.has(String(body.status))) {
        return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
      }
      updatePayload.status = body.status;
    }

    if (body?.serviceCategory !== undefined) {
      const serviceCategory = String(body.serviceCategory || '').trim();
      if (!isAssociateQuotationServiceCategory(serviceCategory)) {
        return NextResponse.json(
          {
            error: `Service category must be one of: ${ASSOCIATE_QUOTATION_SERVICE_CATEGORIES.join(
              ', '
            )}`,
          },
          { status: 400 }
        );
      }
      updatePayload.serviceCategory = serviceCategory;
    }

    if (body?.associateId !== undefined) {
      if (typeof body.associateId === 'string' && mongoose.Types.ObjectId.isValid(body.associateId)) {
        const associateId = new mongoose.Types.ObjectId(body.associateId);
        updatePayload.associateId = associateId;
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

        updatePayload.countryAbbreviation = countryAbbreviation;
        updatePayload.associateSnapshot = {
          associteName: associte.associteName,
          email: associte.email,
          associteType: associte.associteType,
          contact: associte.contact,
          address: associte.address,
          country: associte.country,
          notes: associte.notes,
        };
      } else if (body.associateId === null || body.associateId === '') {
        return NextResponse.json({ error: 'Associate is required' }, { status: 400 });
      } else {
        return NextResponse.json({ error: 'Invalid associateId' }, { status: 400 });
      }
    }

    const nextServiceCategoryRaw =
      updatePayload.serviceCategory ?? existingQuotation.serviceCategory;

    if (!isAssociateQuotationServiceCategory(nextServiceCategoryRaw)) {
      return NextResponse.json(
        {
          error: `Service category is required and must be one of: ${ASSOCIATE_QUOTATION_SERVICE_CATEGORIES.join(
            ', '
          )}`,
        },
        { status: 400 }
      );
    }

    const nextCountryAbbreviation =
      updatePayload.countryAbbreviation ?? existingQuotation.countryAbbreviation;

    if (!nextCountryAbbreviation) {
      return NextResponse.json(
        { error: 'Country abbreviation is required to generate quotation reference number' },
        { status: 400 }
      );
    }

    const referenceFormatRegex = /^[TPCDL]\s\d{4}-\d{4}\s[A-Z0-9]{2,3}$/;
    const serviceChanged =
      updatePayload.serviceCategory !== undefined &&
      updatePayload.serviceCategory !== existingQuotation.serviceCategory;
    const countryChanged =
      updatePayload.countryAbbreviation !== undefined &&
      updatePayload.countryAbbreviation !== existingQuotation.countryAbbreviation;

    if (
      serviceChanged ||
      countryChanged ||
      !referenceFormatRegex.test(String(existingQuotation.quotationNo || ''))
    ) {
      updatePayload.quotationNo = await generateAssociateQuotationNo({
        serviceCategory: nextServiceCategoryRaw,
        countryAbbreviation: String(nextCountryAbbreviation),
        excludeId: id,
      });
    }

    const associateQuotation = await AssociateQuotation.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).populate({ path: 'associateId', select: 'associteName email associteType contact address notes', strictPopulate: false });

    if (!associateQuotation || !associateQuotation.isActive) {
      return NextResponse.json({ error: 'Associate quotation not found' }, { status: 404 });
    }

    return NextResponse.json(associateQuotation);
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
    return NextResponse.json(toErrorPayload('Failed to update associate quotation', err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid associate quotation id' }, { status: 400 });
    }

    const user = getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const associateQuotation = await AssociateQuotation.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true }
    );
    if (!associateQuotation) {
      return NextResponse.json({ error: 'Associate quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Associate quotation deleted successfully' });
  } catch (err: unknown) {
    return NextResponse.json(toErrorPayload('Failed to delete associate quotation', err), { status: 500 });
  }
}
