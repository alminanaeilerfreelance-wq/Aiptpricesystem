import apiClient from './apiClient';

export type AssociteStatus = 'Big' | 'Small' | 'New' | 'Banned';

export interface Associte {
  _id: string;
  assignedId: string;
  associteName: string;
  country?: string;
  continent?: string;
  companyName?: string;
  address?: string;
  email?: string;
  contact?: string;
  notes?: string;
  associteType?: string;
  status?: AssociteStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssociteListParams {
  search?: string;
  status?: AssociteStatus | '';
  country?: string;
  continent?: string;
  page?: number;
  limit?: number;
}

export interface AssociteListResponse {
  assocites: Associte[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface CreateAssociteDto {
  assignedId: string;
  associteName: string;
  country?: string;
  continent?: string;
  companyName?: string;
  address?: string;
  email?: string;
  contact?: string;
  notes?: string;
  associteType?: string;
  status?: AssociteStatus;
  isActive?: boolean;
}

export const associteService = {
  async list(params?: AssociteListParams): Promise<AssociteListResponse> {
    const response = await apiClient.get<AssociteListResponse>('/api/associte', { params });
    return response.data;
  },

  async getById(id: string): Promise<Associte> {
    const response = await apiClient.get<Associte>(`/api/associte/${id}`);
    return response.data;
  },

  async create(data: CreateAssociteDto): Promise<Associte> {
    const response = await apiClient.post<Associte>('/api/associte', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateAssociteDto>): Promise<Associte> {
    const response = await apiClient.patch<Associte>(`/api/associte/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/associte/${id}`);
  },
};

export default associteService;
