import apiClient from './apiClient';

export interface QuotationsReport {
  total: number;
  approved: number;
  pending: number;
  draft: number;
  rejected: number;
  totalValue: number;
  byService: Array<{ service: string; count: number; value: number }>;
  byCountry: Array<{ country: string; count: number }>;
  monthly: Array<{ month: string; count: number; value: number }>;
}

export interface RevenueReport {
  totalRevenue: number;
  approvedRevenue: number;
  pendingRevenue: number;
  byMonth: Array<{ month: string; revenue: number; count: number }>;
  byService: Record<string, number>;
  byCountry: Record<string, number>;
}

export const reportsService = {
  async getQuotationsReport(): Promise<QuotationsReport> {
    const response = await apiClient.get<QuotationsReport>('/api/reports/quotations');
    return response.data;
  },

  async getRevenueReport(): Promise<RevenueReport> {
    const response = await apiClient.get<RevenueReport>('/api/reports/revenue');
    return response.data;
  },
};
