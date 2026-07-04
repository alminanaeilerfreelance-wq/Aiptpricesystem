import apiClient from './apiClient';

export interface InquireServiceRef {
  _id: string;
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
}

export interface InquireProcedureRef {
  _id: string;
  name: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  countryName?: string;
}

export interface InquireCountryRef {
  _id: string;
  name: string;
  abbreviation: string;
}

export interface InquireClientRef {
  _id: string;
  name: string;
  email?: string;
  companyName?: string;
  country?: string;
  type?: string;
}

export interface Inquire {
  _id: string;
  inquiryDate: string;
  referenceNo: string;
  serviceId: string | InquireServiceRef;
  procedureId?: string | InquireProcedureRef;
  procedureIds: Array<string | InquireProcedureRef>;
  countryIds: Array<string | InquireCountryRef>;
  countryCodes: string[];
  clientId: string | InquireClientRef;
  remarks?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InquireListParams {
  search?: string;
  clientId?: string;
  serviceId?: string;
  countryId?: string;
  procedureId?: string;
  page?: number;
  limit?: number;
}

export interface InquireListResponse {
  inquires: Inquire[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateInquireDto {
  inquiryDate: string;
  serviceId: string;
  procedureIds: string[];
  countryIds: string[];
  clientId: string;
  remarks?: string;
}

export const inquiresService = {
  async list(params?: InquireListParams): Promise<InquireListResponse> {
    const response = await apiClient.get<InquireListResponse>('/api/inquires', { params });
    return response.data;
  },

  async getById(id: string): Promise<Inquire> {
    const response = await apiClient.get<Inquire>(`/api/inquires/${id}`);
    return response.data;
  },

  async create(data: CreateInquireDto): Promise<Inquire> {
    const response = await apiClient.post<Inquire>('/api/inquires', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateInquireDto>): Promise<Inquire> {
    const response = await apiClient.patch<Inquire>(`/api/inquires/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/inquires/${id}`);
  },
};

export default inquiresService;
