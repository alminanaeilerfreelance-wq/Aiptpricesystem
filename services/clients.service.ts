import apiClient from './apiClient';

export interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  country?: string;
  continent?: string;
  companyName?: string;
  type?: 'Individual' | 'Company' | 'Organization';
  registrationNumber?: string;
  taxId?: string;
  notes?: string;
  status?: 'Big' | 'Small' | 'New' | 'Banned';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  clientType?: string;
  country?: string;
  continent?: string;
  companyName?: string;
  type?: 'Individual' | 'Company' | 'Organization';
  registrationNumber?: string;
  taxId?: string;
  notes?: string;
  isActive?: boolean;
}

export interface ClientListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClientListResponse {
  clients: Client[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const clientsService = {
  /**
   * Retrieve a list of clients with optional search filter.
   * GET /api/clients
   */
  async list(params?: ClientListParams): Promise<ClientListResponse> {
    const response = await apiClient.get<ClientListResponse>('/api/clients', { params });
    return response.data;
  },

  /**
   * Retrieve a single client by ID.
   * GET /api/clients/:id
   */
  async getById(id: string): Promise<Client> {
    const response = await apiClient.get<Client>(`/api/clients/${id}`);
    return response.data;
  },

  /**
   * Create a new client.
   * POST /api/clients
   */
  async create(data: object): Promise<Client> {
    const response = await apiClient.post<Client>('/api/clients', data);
    return response.data;
  },

  /**
   * Update an existing client.
   * PATCH /api/clients/:id
   */
  async update(id: string, data: object): Promise<Client> {
    const response = await apiClient.patch<Client>(`/api/clients/${id}`, data);
    return response.data;
  },

  /**
   * Delete a client.
   * DELETE /api/clients/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/clients/${id}`);
  },
};
