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
  byUser?: Array<{ userId: string; name: string; total: number; approved: number; pending: number; draft: number }>;
  topClients?: Array<{ name: string; value: number }>;
  quotationAgeAnalysis?: { lessThan7Days: number; days7to14: number; days14to30: number; moreThan30Days: number };
  amountDistribution?: Array<{ range: string; count: number }>;
}

export interface RevenueReport {
  totalRevenue: number;
  approvedRevenue: number;
  pendingRevenue: number;
  byMonth: Array<{ month: string; revenue: number; count: number }>;
  byService: Record<string, number>;
  byCountry: Record<string, number>;
}

export interface UserActivity {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  quotationNo?: string;
  quotationId?: string;
  timestamp: string;
  details?: string;
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

  async getUserActivities(limit: number = 20): Promise<UserActivity[]> {
    const response = await apiClient.get<UserActivity[]>('/api/reports/activities', {
      params: { limit },
    });
    return response.data;
  },
};
