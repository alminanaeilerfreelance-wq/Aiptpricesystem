import apiClient from './apiClient';

export interface Continent {
  _id: string;
  continent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContinentDto {
  continent: string;
  isActive?: boolean;
}

export interface ContinentListResponse {
  continents: Continent[];
  total: number;
}

export const continentsService = {
  async list(): Promise<ContinentListResponse> {
    const response = await apiClient.get<ContinentListResponse>('/api/continents');
    return response.data;
  },

  async getById(id: string): Promise<Continent> {
    const response = await apiClient.get<Continent>(`/api/continents/${id}`);
    return response.data;
  },

  async create(data: CreateContinentDto): Promise<Continent> {
    const response = await apiClient.post<Continent>('/api/continents', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateContinentDto>): Promise<Continent> {
    const response = await apiClient.patch<Continent>(`/api/continents/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/continents/${id}`);
  },
};
