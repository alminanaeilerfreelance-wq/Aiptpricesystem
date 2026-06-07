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

const getInquiryCountryNames = (inquiry: any): string[] =>
  Array.isArray(inquiry?.countryIds)
    ? inquiry.countryIds.map((country: any) => String(country?.name || '').trim()).filter(Boolean)
    : [];

const validateServiceCountries = (services: RawServiceItem[], inquiry: any): string[] => {
  const allowedCountryNames = new Set(
    getInquiryCountryNames(inquiry).map((countryName) => countryName.toLowerCase())
  );
  if (allowedCountryNames.size === 0) return [];

  return services.flatMap((service, index) => {
    const countryName = String(service.countryName || '').trim();
    if (!countryName) return [`Service row ${index + 1}: Country is required.`];
    if (!allowedCountryNames.has(countryName.toLowerCase())) {
      return [`Service row ${index + 1}: Country must match the inquiry countries.`];
    }
    return [];
  });
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

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const sanitizeRichText = (value: string) =>
  value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');

const toIdString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && '_id' in value) {
    return String((value as { _id?: unknown })._id || '');
  }
  return '';
};

const getRequestedRequirementIds = (body: Record<string, unknown>) => {
  const rawIds = Array.isArray(body.requirementIds)
    ? body.requirementIds
    : typeof body.requirementId === 'string'
      ? [body.requirementId]
      : [];

  return Array.from(
    new Set(rawIds.map((id) => String(id || '').trim()).filter(Boolean))
  );
};

const buildRequirementPayload = async (
  requestedIds: string[],
  inquiry: any,
  serviceCategory: ServiceCategory
) => {
  if (requestedIds.length === 0) {
    return {};
  }

  const invalidId = requestedIds.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalidId) {
    return { error: 'Invalid requirement selection', status: 400 };
  }

  const inquiryCountryIds = new Set(
    (Array.isArray(inquiry?.countryIds) ? inquiry.countryIds : [])
      .map((country: any) => toIdString(country))
      .filter(Boolean)
  );

  const requirements = await Requirement.find({ _id: { $in: requestedIds } })
    .populate({ path: 'country', select: 'name', strictPopulate: false })
    .lean();
  const requirementById = new Map(requirements.map((requirement: any) => [String(requirement._id), requirement]));
  const orderedRequirements = requestedIds
    .map((id) => requirementById.get(id))
    .filter(Boolean);

  if (orderedRequirements.length !== requestedIds.length) {
    return { error: 'Requirement not found', status: 404 };
  }

  const invalidRequirement = orderedRequirements.find((requirement: any) => {
    const requirementCountryId = toIdString(requirement.country);
    const matchesCountry = inquiryCountryIds.size === 0 || inquiryCountryIds.has(requirementCountryId);
    const matchesService = !requirement.serviceCategory || requirement.serviceCategory === serviceCategory;
    return !matchesCountry || !matchesService;
  });

  if (invalidRequirement) {
    return {
      error: 'Selected requirements must match the inquiry countries and service',
      status: 400,
    };
  }

  const selectedRequirements = orderedRequirements.map((requirement: any) => ({
    requirementId: requirement._id,
    countryName: requirement.country?.name || '',
    title: String(requirement.title || '').trim(),
    requirements: sanitizeRichText(String(requirement.requirements || '')),
  }));

  const countryName = Array.from(
    new Set(selectedRequirements.map((requirement) => requirement.countryName).filter(Boolean))
  ).join(', ');
  const title = selectedRequirements
    .map((requirement) => requirement.title)
    .filter(Boolean)
    .join(', ');
  const requirementsHtml = selectedRequirements
    .map((requirement) => `
      <section>
        <h4>${escapeHtml(requirement.title || 'Requirement')}</h4>
        <p><strong>Country:</strong> ${escapeHtml(requirement.countryName || '-')}</p>
        ${requirement.requirements || ''}
      </section>
    `)
    .join('');

  return {
    requirementId: selectedRequirements[0]?.requirementId,
    requirementIds: selectedRequirements.map((requirement) => requirement.requirementId),
    requirementSnapshot: {
      countryName,
      title,
      requirements: requirementsHtml,
      selectedRequirements,
    },
  };
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
        { 'services.countryName': { $regex: safeSearch, $options: 'i' } },
      ];
    }

    const [clientQuotations, total] = await Promise.all([
      ClientQuotation.find(filter)
        .populate({ path: 'clientId', select: 'name email type country phone', strictPopulate: false })
        .populate({ path: 'inquiryId', select: 'referenceNo', strictPopulate: false })
        .populate({ path: 'requirementId', select: 'title requirements country', strictPopulate: false })
        .populate({ path: 'requirementIds', select: 'title requirements country', strictPopulate: false })
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
    const serviceCountryErrors = validateServiceCountries(services, inquiry);
    if (serviceCountryErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid service countries',
          details: serviceCountryErrors,
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

    const requirementPayload = await buildRequirementPayload(
      getRequestedRequirementIds(body || {}),
      inquiry,
      serviceCategory
    );
    if ('error' in requirementPayload) {
      return NextResponse.json(
        { error: requirementPayload.error },
        { status: requirementPayload.status as number }
      );
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
      ...requirementPayload,
      inquiryProjects: [String(inquiry.referenceNo || '').trim()],
      serviceCategory,
      services: normalized,
      ...totals,
      status: body?.status || 'Submitted',
    });

    const populated = await clientQuotation.populate([
      { path: 'clientId', select: 'name email type country phone', strictPopulate: false },
      { path: 'inquiryId', select: 'referenceNo', strictPopulate: false },
      { path: 'requirementId', select: 'title requirements country', strictPopulate: false },
      { path: 'requirementIds', select: 'title requirements country', strictPopulate: false },
    ]);

    return NextResponse.json(populated, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof mongoose.Error.ValidationError) {
      return NextResponse.json(toErrorPayload('Invalid client quotation payload', err), { status: 400 });
    }
    return NextResponse.json(toErrorPayload('Failed to create client quotation', err), { status: 500 });
  }
}
