import apiClient from './apiClient';

export interface AssociateQuotationServiceItem {
  procedureId?: string;
  procedureName: string;
  classType: 'single' | 'multi';
  numberOfClasses: number;
  additionalFeePerClass: number;
  officialFee: number;
  additionalClassFees: number;
  totalOfficialFees: number;
  attorneyFee: number;
  officeFee: number;
  otherFees: number;
  totalAmount: number;
  grandTotal: number;
}

export interface AssociateQuotation {
  _id: string;
  quotationNo: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  countryAbbreviation: string;
  associateId?: string | {
    _id: string;
    associteName?: string;
    email?: string;
    associteType?: string;
    contact?: string;
    address?: string;
    notes?: string;
  };
  associateSnapshot?: {
    associteName?: string;
    email?: string;
    associteType?: string;
    contact?: string;
    address?: string;
    notes?: string;
  };
  inquiryProject: string;
  inquiryId?: string | { _id: string; referenceNo?: string };
  inquirySnapshot?: {
    referenceNo?: string;
    procedureName?: string;
    countryNames?: string[];
  };
  services: AssociateQuotationServiceItem[];
  totalOfficialFees: number;
  totalAttorneyFees: number;
  totalOfficeFees: number;
  totalOtherFees: number;
  grandTotal: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface AssociateQuotationListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface AssociateQuotationListResponse {
  associateQuotations: AssociateQuotation[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateAssociateQuotationDto {
  associateId?: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  inquiryProject: string;
  inquiryId?: string;
  services: Array<Partial<AssociateQuotationServiceItem> & { procedureName: string }>;
  status?: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
}

export const associateQuotationsService = {
  async list(params?: AssociateQuotationListParams): Promise<AssociateQuotationListResponse> {
    const response = await apiClient.get<AssociateQuotationListResponse>('/api/associate-quotations', { params });
    return response.data;
  },

  async getById(id: string): Promise<AssociateQuotation> {
    const response = await apiClient.get<AssociateQuotation>(`/api/associate-quotations/${id}`);
    return response.data;
  },

  async create(data: CreateAssociateQuotationDto): Promise<AssociateQuotation> {
    const response = await apiClient.post<AssociateQuotation>('/api/associate-quotations', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateAssociateQuotationDto>): Promise<AssociateQuotation> {
    const response = await apiClient.patch<AssociateQuotation>(`/api/associate-quotations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/associate-quotations/${id}`);
  },
};

export default associateQuotationsService;
