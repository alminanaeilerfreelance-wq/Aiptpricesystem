import apiClient from './apiClient';

export interface Service {
  _id: string;
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  description?: string;
  basePrice?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceDto {
  name: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  description?: string;
  basePrice?: number;
  isActive?: boolean;
}

export interface ServiceListParams {
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ServiceListResponse {
  services: Service[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const servicesService = {
  /**
   * Retrieve a list of services with optional category filter.
   * GET /api/services
   */
  async list(params?: ServiceListParams): Promise<ServiceListResponse> {
    const response = await apiClient.get<ServiceListResponse>('/api/services', { params });
    return response.data;
  },

  /**
   * Retrieve a single service by ID.
   * GET /api/services/:id
   */
  async getById(id: string): Promise<Service> {
    const response = await apiClient.get<Service>(`/api/services/${id}`);
    return response.data;
  },

  /**
   * Create a new service.
   * POST /api/services
   */
  async create(data: object): Promise<Service> {
    const response = await apiClient.post<Service>('/api/services', data);
    return response.data;
  },

  /**
   * Update an existing service.
   * PATCH /api/services/:id
   */
  async update(id: string, data: object): Promise<Service> {
    const response = await apiClient.patch<Service>(`/api/services/${id}`, data);
    return response.data;
  },

  /**
   * Delete a service.
   * DELETE /api/services/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/services/${id}`);
  },
};
