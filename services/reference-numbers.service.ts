import apiClient from './apiClient';

export type ReferenceNumberStatus = 'Available' | 'Reserved' | 'Used' | 'Cancelled';
export type ReferenceServiceType = 'Trademark' | 'Patent' | 'Design' | 'Copyright' | 'Other' | 'Litigation';

export interface ReferenceNumber {
  _id: string;
  referenceNo: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  serviceType: ReferenceServiceType;
  serviceCode: string;
  sequence: number;
  status: ReferenceNumberStatus;
  usedBy?: string;
  usedByClientName?: string;
  usedByAssignedId?: string;
  usedDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReferenceNumberListParams {
  page?: number;
  limit?: number;
  search?: string;
  countryId?: string;
  serviceType?: string;
  status?: string;
  usedBy?: string;
  clientId?: string;
  clientAssignedId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ReferenceNumberListResponse {
  referenceNumbers: ReferenceNumber[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ReferencePreview {
  referenceNo: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  serviceType: ReferenceServiceType;
  serviceCode: string;
  sequence: number;
  status: ReferenceNumberStatus;
}

export const referenceNumbersService = {
  async list(params?: ReferenceNumberListParams): Promise<ReferenceNumberListResponse> {
    const response = await apiClient.get<ReferenceNumberListResponse>('/api/reference-numbers', { params });
    return response.data;
  },

  async listAvailable(params?: Omit<ReferenceNumberListParams, 'status'>): Promise<ReferenceNumberListResponse> {
    const response = await apiClient.get<ReferenceNumberListResponse>('/api/reference-numbers/available', { params });
    return response.data;
  },

  async generate(data: { countryId: string; serviceType: ReferenceServiceType; quantity: number; assignedId: string }): Promise<{
    references: ReferencePreview[];
    latestSequence: number;
  }> {
    const response = await apiClient.post('/api/reference-numbers/generate', data);
    return response.data;
  },

  async register(data: { references: ReferencePreview[]; usedBy?: string }): Promise<{
    registered: ReferenceNumber[];
    count: number;
  }> {
    const response = await apiClient.post('/api/reference-numbers/register', data);
    return response.data;
  },

  async update(id: string, data: Partial<Pick<ReferenceNumber, 'status' | 'usedBy' | 'usedDate'>>): Promise<ReferenceNumber> {
    const response = await apiClient.put<ReferenceNumber>(`/api/reference-numbers/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/reference-numbers/${id}`);
  },
};
