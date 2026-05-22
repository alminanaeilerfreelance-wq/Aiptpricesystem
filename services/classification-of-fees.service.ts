import apiClient from './apiClient';

export interface ClassificationOfFee {
  _id: string;
  description: string;
  remarks: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassificationOfFeeDto {
  description: string;
  remarks: string;
  isActive?: boolean;
}

export interface ClassificationOfFeeListResponse {
  classificationOfFees: ClassificationOfFee[];
  total: number;
}

export const classificationOfFeesService = {
  async list(): Promise<ClassificationOfFeeListResponse> {
    const response = await apiClient.get<ClassificationOfFeeListResponse>('/api/classification-of-fees');
    return response.data;
  },

  async getById(id: string): Promise<ClassificationOfFee> {
    const response = await apiClient.get<ClassificationOfFee>(`/api/classification-of-fees/${id}`);
    return response.data;
  },

  async create(data: CreateClassificationOfFeeDto): Promise<ClassificationOfFee> {
    const response = await apiClient.post<ClassificationOfFee>('/api/classification-of-fees', data);
    return response.data;
  },

  async update(
    id: string,
    data: Partial<CreateClassificationOfFeeDto>
  ): Promise<ClassificationOfFee> {
    const response = await apiClient.patch<ClassificationOfFee>(`/api/classification-of-fees/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/classification-of-fees/${id}`);
  },
};
