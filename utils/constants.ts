export const SERVICE_CATEGORIES = ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'] as const;
export type ServiceCategory = typeof SERVICE_CATEGORIES[number];

export const QUOTATION_STATUSES = ['Draft', 'Pending', 'Approved', 'Rejected'] as const;
export type QuotationStatus = typeof QUOTATION_STATUSES[number];

export const CLIENT_TYPES_DEFAULT = ['Individual', 'Company', 'Organization', 'Government'] as const;

export const CURRENCIES = ['SAR', 'USD', 'EUR', 'AED', 'GBP'] as const;

export const DEFAULT_VALID_DAYS = 30;
