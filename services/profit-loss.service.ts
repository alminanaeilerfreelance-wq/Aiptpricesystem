import apiClient from './apiClient';

export interface ProfitLossRecord {
  inquiryProject: string;
  clientQuotationId: string;
  clientQuotationNo: string;
  associateQuotationId: string;
  associateQuotationNo: string;
  clientQuotationTotal: number;
  associateQuotationTotal: number;
  profitOrLoss: number;
  status: 'Profit' | 'Loss' | 'Break-even';
  createdAt: string;
}

export interface ProfitLossSummary {
  totalProfit: number;
  totalLoss: number;
  netTotal: number;
}

export interface ProfitLossResponse {
  records: ProfitLossRecord[];
  summary: ProfitLossSummary;
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface ProfitLossParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const profitLossService = {
  async list(params?: ProfitLossParams): Promise<ProfitLossResponse> {
    const response = await apiClient.get<ProfitLossResponse>('/api/profit-loss', { params });
    return response.data;
  },
};

export default profitLossService;
