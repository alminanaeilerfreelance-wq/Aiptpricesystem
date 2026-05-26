import apiClient from './apiClient';

export interface OwnOffice {
  _id: string;
  country: string;
  companyName: string;
  address?: string;
  tax?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnOfficeListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface OwnOfficeListResponse {
  ownOffices: OwnOffice[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateOwnOfficeDto {
  country: string;
  companyName: string;
  address?: string;
  tax?: string;
  isActive?: boolean;
}

export const ownOfficesService = {
  async list(params?: OwnOfficeListParams): Promise<OwnOfficeListResponse> {
    const response = await apiClient.get<OwnOfficeListResponse>('/api/own-offices', { params });
    return response.data;
  },

  async getById(id: string): Promise<OwnOffice> {
    const response = await apiClient.get<OwnOffice>(`/api/own-offices/${id}`);
    return response.data;
  },

  async create(data: CreateOwnOfficeDto): Promise<OwnOffice> {
    const response = await apiClient.post<OwnOffice>('/api/own-offices', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateOwnOfficeDto>): Promise<OwnOffice> {
    const response = await apiClient.patch<OwnOffice>(`/api/own-offices/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/own-offices/${id}`);
  },
};

export default ownOfficesService;
