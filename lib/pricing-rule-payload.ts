import mongoose from 'mongoose';
import Client from '@/models/Client';
import Country from '@/models/Country';
import Procedure from '@/models/Procedure';
import Service from '@/models/Service';

const SERVICE_CATEGORIES = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'] as const;

type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

type ExistingPricingRule = {
  clientId?: mongoose.Types.ObjectId | string;
  clientName?: string;
  serviceCategory?: string;
  procedureName?: string;
  countryName?: string;
  countryAbbreviation?: string;
  officialFee?: number;
  attorneyFee?: number;
  classFee?: number;
  isActive?: boolean;
};

type PayloadResult =
  | {
      data: {
        clientId?: mongoose.Types.ObjectId;
        clientName?: string;
        serviceCategory: ServiceCategory;
        procedureName: string;
        countryName: string;
        countryAbbreviation: string;
        officialFee: number;
        attorneyFee: number;
        classFee: number;
        isActive: boolean;
      };
    }
  | { error: string };

type FeeResult = { value: number } | { error: string };

const getText = (body: Record<string, unknown>, field: string, fallback?: unknown) => {
  const value = body[field] === undefined ? fallback : body[field];
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim();
};

const getFee = (
  body: Record<string, unknown>,
  field: 'officialFee' | 'attorneyFee' | 'classFee',
  label: string,
  fallback?: number
): FeeResult => {
  const raw = body[field] === undefined ? fallback ?? 0 : body[field];
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `${label} must be a non-negative number` };
  }
  return { value };
};

const toCountryPayload = (countryDetail: any) =>
  countryDetail
    ? {
        _id: countryDetail._id,
        name: countryDetail.name,
        abbreviation: countryDetail.abbreviation,
        flagCode: countryDetail.flagCode,
        isActive: countryDetail.isActive,
      }
    : null;

const toServicePayload = (serviceDetail: any) =>
  serviceDetail
    ? {
        _id: serviceDetail._id,
        name: serviceDetail.name,
        category: serviceDetail.category,
        basePrice: serviceDetail.basePrice,
        isActive: serviceDetail.isActive,
      }
    : null;

const toProcedurePayload = (procedureDetail: any) =>
  procedureDetail
    ? {
        _id: procedureDetail._id,
        name: procedureDetail.name,
        serviceCategory: procedureDetail.serviceCategory,
        serviceName: procedureDetail.serviceName,
        isActive: procedureDetail.isActive,
      }
    : null;

export async function buildPricingRulePayload(
  body: Record<string, unknown>,
  current?: ExistingPricingRule
): Promise<PayloadResult> {
  let serviceCategory = getText(body, 'serviceCategory', current?.serviceCategory);
  if (!SERVICE_CATEGORIES.includes(serviceCategory as ServiceCategory)) {
    return { error: 'Valid service is required' };
  }
  serviceCategory = serviceCategory as ServiceCategory;

  let countryName = getText(body, 'countryName', current?.countryName);
  let countryAbbreviation = getText(body, 'countryAbbreviation', current?.countryAbbreviation).toUpperCase();
  const countryId = getText(body, 'countryId');

  if (countryId) {
    if (!mongoose.Types.ObjectId.isValid(countryId)) {
      return { error: 'Valid country is required' };
    }

    const country = await Country.findOne({ _id: countryId, isActive: true }).lean();
    if (!country) {
      return { error: 'Country not found' };
    }

    countryName = String(country.name || '').trim();
    countryAbbreviation = String(country.abbreviation || '').trim().toUpperCase();
  }

  if (!countryName || !countryAbbreviation) {
    return { error: 'Country is required' };
  }

  let procedureName = getText(body, 'procedureName', current?.procedureName);
  const procedureId = getText(body, 'procedureId');

  if (procedureId) {
    if (!mongoose.Types.ObjectId.isValid(procedureId)) {
      return { error: 'Valid procedure is required' };
    }

    const procedure = await Procedure.findOne({ _id: procedureId, isActive: true }).lean();
    if (!procedure) {
      return { error: 'Procedure not found' };
    }

    if (procedure.serviceCategory !== serviceCategory) {
      return { error: 'Procedure does not match the selected service' };
    }

    procedureName = String(procedure.name || '').trim();
  }

  if (!procedureName) {
    return { error: 'Procedure is required' };
  }

  let clientId: mongoose.Types.ObjectId | undefined;
  let clientName = getText(body, 'clientName', current?.clientName);
  const rawClientId = getText(body, 'clientId', current?.clientId);

  if (rawClientId) {
    if (!mongoose.Types.ObjectId.isValid(rawClientId)) {
      return { error: 'Valid client is required' };
    }

    const client = await Client.findOne({ _id: rawClientId, isActive: true }).lean();
    if (!client) {
      return { error: 'Client not found' };
    }

    clientId = new mongoose.Types.ObjectId(rawClientId);
    clientName = String(client.companyName || client.name || '').trim();
  }

  const officialFee = getFee(body, 'officialFee', 'Office Fee', current?.officialFee);
  const attorneyFee = getFee(body, 'attorneyFee', 'Attorney Fee', current?.attorneyFee);
  const classFee = getFee(body, 'classFee', 'Class Fee', current?.classFee);
  if ('error' in officialFee) return officialFee;
  if ('error' in attorneyFee) return attorneyFee;
  if ('error' in classFee) return classFee;

  return {
    data: {
      ...(clientId ? { clientId, clientName } : {}),
      serviceCategory: serviceCategory as ServiceCategory,
      countryName,
      countryAbbreviation,
      procedureName,
      officialFee: officialFee.value,
      attorneyFee: attorneyFee.value,
      classFee: classFee.value,
      isActive: body.isActive === undefined ? current?.isActive !== false : body.isActive !== false,
    },
  };
}

export async function enrichPricingRuleObject(ruleObject: Record<string, any>) {
  const countryCode = String(ruleObject.countryAbbreviation || '').toUpperCase();
  const [countryDetail, serviceDetail, procedureDetail] = await Promise.all([
    countryCode ? Country.findOne({ abbreviation: countryCode }).lean() : null,
    ruleObject.serviceCategory ? Service.findOne({ category: ruleObject.serviceCategory }).lean() : null,
    ruleObject.serviceCategory && ruleObject.procedureName
      ? Procedure.findOne({
          serviceCategory: ruleObject.serviceCategory,
          name: ruleObject.procedureName,
          isActive: true,
        }).lean()
      : null,
  ]);

  return {
    ...ruleObject,
    status: ruleObject.isActive ? 'Active' : 'Inactive',
    country: toCountryPayload(countryDetail),
    service: toServicePayload(serviceDetail),
    procedure: toProcedurePayload(procedureDetail),
  };
}
