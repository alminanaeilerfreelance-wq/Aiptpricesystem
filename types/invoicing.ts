export const invoicingModuleTypes = ['Bank', 'Trademark', 'Patent', 'Design', 'Copyright', 'Litigation', 'Others'] as const;
export const serviceModuleTypes = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation', 'Others'] as const;

export type InvoicingModuleType = (typeof invoicingModuleTypes)[number];
export type ServiceModuleType = (typeof serviceModuleTypes)[number];

export interface BankRecord {
  id: string;
  bankName: string;
  bankHeader: string;
  bankDescription: string;
  accountName?: string | null;
  accountNumber?: string | null;
  iban?: string | null;
  swift?: string | null;
  currency?: string | null;
  status: 'Active' | 'Abandon' | 'Cancel';
  createdAt: string;
  updatedAt: string;
}

export interface ServiceApplicationRecord {
  id: string;
  moduleType: ServiceModuleType;
  clientId: string;
  clientName: string;
  countryId: string;
  countryName: string;
  aiptReferenceId?: string | null;
  aiptReference?: string | null;
  classNo?: number | null;
  filingNumber?: string | null;
  applicationName: string;
  allowDuplicateFilingNumber: boolean;
  status: 'Active' | 'Abandon' | 'Cancel';
  markImage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InvoicingRecord = BankRecord | ServiceApplicationRecord;

export interface InvoicingListParams {
  moduleType: InvoicingModuleType;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface InvoicingListResult {
  records: InvoicingRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
