import apiClient from './apiClient';

export type ClientType = 'Agent' | 'Direct';
export type ClientStatus = 'Big' | 'Small' | 'New' | 'Banned';
export type ClientServiceType = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Litigation';

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
  assignedServiceType?: ClientServiceType;
  assignedIdCount?: number;
  type?: ClientType | string;
  assignedId?: string;
  registrationNumber?: string;
  taxId?: string;
  notes?: string;
  status?: ClientStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientDto {
  assignedId?: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  address?: string;
  companyName?: string;
  assignedServiceType?: ClientServiceType;
  assignedIdCount?: number;
  type?: ClientType;
  notes?: string;
  status?: ClientStatus;
  isActive?: boolean;
}

export interface ClientListParams {
  search?: string;
  page?: number;
  limit?: number;
  all?: boolean;
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
    const response = await apiClient.get<ClientListResponse>('/api/clients', {
      params: { ...params, all: params?.all ? 'true' : undefined },
    });
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
  async create(data: CreateClientDto): Promise<Client> {
    const response = await apiClient.post<Client>('/api/clients', data);
    return response.data;
  },

  /**
   * Update an existing client.
   * PATCH /api/clients/:id
   */
  async update(id: string, data: Partial<CreateClientDto>): Promise<Client> {
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

  /**
   * Delete every client from the database.
   * DELETE /api/clients
   */
  async deleteAll(): Promise<{ message: string; deletedCount: number }> {
    const response = await apiClient.delete<{ message: string; deletedCount: number }>('/api/clients');
    return response.data;
  },
};
