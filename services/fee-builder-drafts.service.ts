import apiClient from './apiClient';
import { FeeBuilderDraft } from '@/lib/fee-builder-drafts';

export interface FeeBuilderDraftListResponse {
  drafts: FeeBuilderDraft[];
  total: number;
}

export type FeeBuilderDraftPayload = Omit<FeeBuilderDraft, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<FeeBuilderDraft, 'id' | 'createdAt' | 'updatedAt'>>;

export const feeBuilderDraftsService = {
  async list(): Promise<FeeBuilderDraft[]> {
    const response = await apiClient.get<FeeBuilderDraftListResponse>('/api/fee-builder-drafts');
    return response.data.drafts || [];
  },

  async getById(id: string): Promise<FeeBuilderDraft> {
    const response = await apiClient.get<FeeBuilderDraft>(`/api/fee-builder-drafts/${id}`);
    return response.data;
  },

  async create(data: FeeBuilderDraftPayload): Promise<FeeBuilderDraft> {
    const response = await apiClient.post<FeeBuilderDraft>('/api/fee-builder-drafts', data);
    return response.data;
  },

  async update(id: string, data: FeeBuilderDraftPayload): Promise<FeeBuilderDraft> {
    const response = await apiClient.patch<FeeBuilderDraft>(`/api/fee-builder-drafts/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/fee-builder-drafts/${id}`);
  },

  async deleteAll(adminPassword: string): Promise<{ deletedCount: number; message?: string }> {
    const response = await apiClient.delete<{ deletedCount: number; message?: string }>('/api/fee-builder-drafts', {
      data: { adminPassword },
    });
    return response.data;
  },
};
