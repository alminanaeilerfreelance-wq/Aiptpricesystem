import apiClient from './apiClient';

export interface ClientType {
  _id: string;
  name: string; 
  description?: string;
  multiplier?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientTypeDto {
  name: string;
  description?: string;
  multiplier?: number;
  isActive?: boolean;
}

export interface ClientTypeListResponse {
  clientTypes: ClientType[];
  total: number;
}

export interface ClientTypeListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export const clientTypesService = {
  /**
   * Retrieve a list of all client types.
   * GET /api/client-types
   */
  async list(params?: ClientTypeListParams): Promise<ClientTypeListResponse> {
    const response = await apiClient.get<ClientTypeListResponse>('/api/client-types', { params });
    return response.data;
  },

  /**
   * Retrieve a single client type by ID.
   * GET /api/client-types/:id
   */
  async getById(id: string): Promise<ClientType> {
    const response = await apiClient.get<ClientType>(`/api/client-types/${id}`);
    return response.data;
  },

  /**
   * Create a new client type.
   * POST /api/client-types
   */
  async create(data: object): Promise<ClientType> {
    const response = await apiClient.post<ClientType>('/api/client-types', data);
    return response.data;
  },

  /**
   * Update an existing client type.
   * PATCH /api/client-types/:id
   */
  async update(id: string, data: object): Promise<ClientType> {
    const response = await apiClient.patch<ClientType>(`/api/client-types/${id}`, data);
    return response.data;
  },

  /**
   * Delete a client type.
   * DELETE /api/client-types/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/client-types/${id}`);
  },
};
