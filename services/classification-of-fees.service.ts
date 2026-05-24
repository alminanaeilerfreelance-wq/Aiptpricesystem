import apiClient from './apiClient';

export interface ClassificationOfFee {
  _id: string;
  name: string;
  description?: string;
  remarks?: string;
  minFee: number;
  maxFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClassificationOfFeeDto {
  name?: string;
  description?: string;
  remarks?: string;
  minFee?: number;
  maxFee?: number;
  isActive?: boolean;
}

export interface ClassificationOfFeeListResponse {
  classificationOfFees: ClassificationOfFee[];
  classifications: ClassificationOfFee[];
  total: number;
}

interface ApiClassificationOfFee {
  _id: string;
  description: string;
  remarks: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ApiClassificationOfFeeListResponse {
  classificationOfFees: ApiClassificationOfFee[];
  total: number;
}

interface ClassificationOfFeeListParams {
  page?: number;
  limit?: number;
  search?: string;
}

const toUiItem = (item: ApiClassificationOfFee): ClassificationOfFee => ({
  _id: item._id,
  name: item.description,
  description: item.remarks,
  remarks: item.remarks,
  minFee: 0,
  maxFee: 0,
  isActive: item.isActive,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const toApiPayload = (data: CreateClassificationOfFeeDto): {
  description: string;
  remarks: string;
  isActive?: boolean;
} => ({
  description: (data.name ?? data.description ?? '').trim(),
  remarks: (data.remarks ?? data.description ?? '').trim(),
  isActive: data.isActive,
});

export const classificationOfFeesService = {
  async list(params?: ClassificationOfFeeListParams): Promise<ClassificationOfFeeListResponse> {
    const response = await apiClient.get<ApiClassificationOfFeeListResponse>(
      '/api/classification-of-fees',
      { params }
    );
    const classificationOfFees = Array.isArray(response.data?.classificationOfFees)
      ? response.data.classificationOfFees.map(toUiItem)
      : [];

    return {
      classificationOfFees,
      classifications: classificationOfFees,
      total: response.data?.total ?? classificationOfFees.length,
    };
  },

  async getById(id: string): Promise<ClassificationOfFee> {
    const response = await apiClient.get<ApiClassificationOfFee>(`/api/classification-of-fees/${id}`);
    return toUiItem(response.data);
  },

  async create(data: CreateClassificationOfFeeDto): Promise<ClassificationOfFee> {
    const response = await apiClient.post<ApiClassificationOfFee>(
      '/api/classification-of-fees',
      toApiPayload(data)
    );
    return toUiItem(response.data);
  },

  async update(
    id: string,
    data: Partial<CreateClassificationOfFeeDto>
  ): Promise<ClassificationOfFee> {
    const response = await apiClient.patch<ApiClassificationOfFee>(
      `/api/classification-of-fees/${id}`,
      toApiPayload(data)
    );
    return toUiItem(response.data);
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/classification-of-fees/${id}`);
  },
};
