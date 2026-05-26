import apiClient from './apiClient';

export interface ClientQuotationServiceItem {
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
  discount: number;
  totalAmount: number;
  grandTotal: number;
}

export interface ClientQuotation {
  _id: string;
  quotationNo: string;
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
  inquiryProjects: string[];
  services: ClientQuotationServiceItem[];
  totalOfficialFees: number;
  totalAttorneyFees: number;
  totalOfficeFees: number;
  totalOtherFees: number;
  totalDiscount: number;
  grandTotal: number;
  status: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ClientQuotationListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClientQuotationListResponse {
  clientQuotations: ClientQuotation[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateClientQuotationDto {
  associateId?: string;
  inquiryProjects: string[];
  services: Array<Partial<ClientQuotationServiceItem> & { procedureName: string }>;
  status?: 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
}

export const clientQuotationsService = {
  async list(params?: ClientQuotationListParams): Promise<ClientQuotationListResponse> {
    const response = await apiClient.get<ClientQuotationListResponse>('/api/client-quotations', { params });
    return response.data;
  },

  async getById(id: string): Promise<ClientQuotation> {
    const response = await apiClient.get<ClientQuotation>(`/api/client-quotations/${id}`);
    return response.data;
  },

  async create(data: CreateClientQuotationDto): Promise<ClientQuotation> {
    const response = await apiClient.post<ClientQuotation>('/api/client-quotations', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateClientQuotationDto>): Promise<ClientQuotation> {
    const response = await apiClient.patch<ClientQuotation>(`/api/client-quotations/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/client-quotations/${id}`);
  },
};

export default clientQuotationsService;
