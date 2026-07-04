import mongoose from 'mongoose';
import AssociateQuotation from '@/models/AssociateQuotation';
import Country from '@/models/Country';

export const ASSOCIATE_QUOTATION_SERVICE_CATEGORIES = [
  'Trademark',
  'Patent',
  'Copyright',
  'Design',
  'Litigation',
] as const;

export type AssociateQuotationServiceCategory =
  (typeof ASSOCIATE_QUOTATION_SERVICE_CATEGORIES)[number];

const SERVICE_CODE_BY_CATEGORY: Record<AssociateQuotationServiceCategory, string> = {
  Trademark: 'T',
  Patent: 'P',
  Copyright: 'C',
  Design: 'D',
  Litigation: 'L',
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeCountryAbbreviation = (value: string): string => {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length <= 3) return normalized;
  return normalized.slice(0, 3);
};

const deriveCountryAbbreviation = (countryValue: string): string => {
  const words = countryValue
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return normalizeCountryAbbreviation(`${words[0][0]}${words[1][0]}`);
  }

  return normalizeCountryAbbreviation(words[0]?.slice(0, 2) || '');
};

export const isAssociateQuotationServiceCategory = (
  value: unknown
): value is AssociateQuotationServiceCategory =>
  typeof value === 'string' &&
  ASSOCIATE_QUOTATION_SERVICE_CATEGORIES.includes(
    value as AssociateQuotationServiceCategory
  );

export const resolveCountryAbbreviationFromValue = async (
  rawCountryValue: unknown
): Promise<string | null> => {
  if (typeof rawCountryValue !== 'string') return null;
  const countryValue = rawCountryValue.trim();
  if (!countryValue) return null;

  if (/^[A-Za-z]{2,3}$/.test(countryValue)) {
    return normalizeCountryAbbreviation(countryValue);
  }

  const safeValue = escapeRegex(countryValue);
  const matchedCountry = await Country.findOne({
    isActive: true,
    $or: [
      { name: { $regex: `^${safeValue}$`, $options: 'i' } },
      { abbreviation: { $regex: `^${safeValue}$`, $options: 'i' } },
    ],
  })
    .select('abbreviation')
    .lean();

  if (matchedCountry?.abbreviation) {
    return normalizeCountryAbbreviation(matchedCountry.abbreviation);
  }

  const derived = deriveCountryAbbreviation(countryValue);
  return derived || null;
};

interface GenerateAssociateQuotationNoParams {
  serviceCategory: AssociateQuotationServiceCategory;
  countryAbbreviation: string;
  excludeId?: string;
}

export const generateAssociateQuotationNo = async ({
  serviceCategory,
  countryAbbreviation,
  excludeId,
}: GenerateAssociateQuotationNoParams): Promise<string> => {
  const serviceCode = SERVICE_CODE_BY_CATEGORY[serviceCategory];
  const year = new Date().getFullYear();
  const normalizedCountry =
    normalizeCountryAbbreviation(countryAbbreviation || '') || 'XX';

  // Count + collision-check loop keeps the number compact even with soft-deleted records.
  const regex = `^${escapeRegex(
    `${serviceCode} ${year}-`
  )}\\d{4} ${escapeRegex(normalizedCountry)}$`;
  const filter: Record<string, any> = { quotationNo: { $regex: regex } };
  if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
    filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
  }

  const baseCount = await AssociateQuotation.countDocuments(filter);
  for (let serial = baseCount + 1; serial < baseCount + 5000; serial += 1) {
    const candidate = `${serviceCode} ${year}-${String(serial).padStart(
      4,
      '0'
    )} ${normalizedCountry}`;
    const exists = await AssociateQuotation.exists({
      ...filter,
      quotationNo: candidate,
    });
    if (!exists) {
      return candidate;
    }
  }

  return `${serviceCode} ${year}-${String(Date.now() % 10000).padStart(
    4,
    '0'
  )} ${normalizedCountry}`;
};

