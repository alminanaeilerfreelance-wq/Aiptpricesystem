import apiClient from './apiClient';

export interface Country {
  _id: string;
  name: string;
  abbreviation: string;
  flagCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCountryDto {
  name: string;
  abbreviation: string;
  flagCode: string;
  isActive?: boolean;
}

export interface CountryListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface CountryListResponse {
  countries: Country[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const countriesService = {
  async list(params?: CountryListParams): Promise<CountryListResponse> {
    const response = await apiClient.get<CountryListResponse>('/api/countries', { params });
    return response.data;
  },

  async getById(id: string): Promise<Country> {
    const response = await apiClient.get<Country>(`/api/countries/${id}`);
    return response.data;
  },

  async create(data: CreateCountryDto): Promise<Country> {
    const response = await apiClient.post<Country>('/api/countries', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateCountryDto>): Promise<Country> {
    const response = await apiClient.patch<Country>(`/api/countries/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/countries/${id}`);
  },
};
