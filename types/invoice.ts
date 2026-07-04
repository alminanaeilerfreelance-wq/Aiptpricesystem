import type { invoiceStatuses, invoiceTypes } from '@/schemas/invoice-schema';

export type InvoiceType = (typeof invoiceTypes)[number];
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  referenceNumber?: string | null;
  applicationNumber?: string | null;
  applicationName?: string | null;
  projectName?: string | null;
  method?: string | null;
  clientMaster?: string | null;
  recipient?: string | null;
  subject?: string | null;
  bankName?: string | null;
  clientId: string;
  clientName: string;
  serviceId?: string | null;
  countryId: string;
  countryName: string;
  procedureId?: string | null;
  bankId?: string | null;
  clientReference?: string | null;
  toAddress?: string | null;
  applicationIds?: string[];
  items?: Array<{
    id?: string;
    pricingRuleId?: string;
    countryId?: string;
    procedureId?: string;
    item: string;
    country: string;
    procedure: string;
    officialFee: number;
    attorneyFee: number;
    quantity: number;
    vatPercentage: number;
    vatAmount: number;
    total: number;
  }>;
  vatable?: boolean;
  vatPercentage?: number;
  subtotalOfficialFee?: number;
  subtotalAttorneyFee?: number;
  totalVat?: number;
  grandTotal?: number;
  invoiceDate: string;
  dueDate?: string | null;
  currency: string;
  amount: number;
  vat: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  remarks?: string | null;
  attachment?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListParams {
  invoiceType?: InvoiceType;
  search?: string;
  status?: InvoiceStatus | 'All';
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface InvoiceListResult {
  invoices: InvoiceRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
