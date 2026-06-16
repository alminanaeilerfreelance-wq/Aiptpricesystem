import apiClient from './apiClient';

export type CompanyServiceCategory =
  | 'Trademark'
  | 'Patent'
  | 'Design'
  | 'Copyright'
  | 'Litigation';

export interface CompanyDetail {
  _id: string;
  continentId?: string;
  continentName?: string;
  countryId?: string;
  countryName?: string;
  companyName: string;
  address?: string;
  contact?: string;
  email?: string;
  logoUrl?: string;
  serviceCategory?: CompanyServiceCategory;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyDetailsListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CompanyDetailsListResponse {
  companyDetails: CompanyDetail[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateCompanyDetailDto {
  companyName: string;
  address?: string;
  contact?: string;
  email?: string;
  logoUrl?: string;
  serviceCategory?: CompanyServiceCategory;
  isActive?: boolean;
}

export const companyDetailsService = {
  async list(params?: CompanyDetailsListParams): Promise<CompanyDetailsListResponse> {
    const response = await apiClient.get<CompanyDetailsListResponse>('/api/company-details', { params });
    return response.data;
  },

  async getById(id: string): Promise<CompanyDetail> {
    const response = await apiClient.get<CompanyDetail>(`/api/company-details/${id}`);
    return response.data;
  },

  async create(data: CreateCompanyDetailDto | FormData): Promise<CompanyDetail> {
    const response = await apiClient.post<CompanyDetail>('/api/company-details', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateCompanyDetailDto> | FormData): Promise<CompanyDetail> {
    const response = await apiClient.patch<CompanyDetail>(`/api/company-details/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/company-details/${id}`);
  },
};

export default companyDetailsService;
