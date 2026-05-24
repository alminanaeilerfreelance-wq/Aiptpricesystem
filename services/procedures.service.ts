import apiClient from './apiClient';

export interface Procedure {
  _id: string;
  name: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  description?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProcedureDto {
  name: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation' | string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProcedureListParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProcedureListResponse {
  procedures: Procedure[];
  total: number;
}

export const proceduresService = {
  async list(params?: ProcedureListParams): Promise<ProcedureListResponse> {
    const response = await apiClient.get<ProcedureListResponse>('/api/procedures', { params });
    return response.data;
  },

  async getById(id: string): Promise<Procedure> {
    const response = await apiClient.get<Procedure>(`/api/procedures/${id}`);
    return response.data;
  },

  async create(data: CreateProcedureDto): Promise<Procedure> {
    const response = await apiClient.post<Procedure>('/api/procedures', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreateProcedureDto>): Promise<Procedure> {
    const response = await apiClient.patch<Procedure>(`/api/procedures/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/procedures/${id}`);
  },
};
