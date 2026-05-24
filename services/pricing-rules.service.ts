import apiClient from './apiClient';

export interface PricingRule {
  _id: string;
  name: string;
  description?: string;
  percentage?: number;
  fixedAmount?: number;
  minServiceValue?: number;
  maxServiceValue?: number;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: number;
  attorneyFee: number;
  classFee: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePricingRuleDto {
  name?: string;
  description?: string;
  percentage?: number;
  fixedAmount?: number;
  minServiceValue?: number;
  maxServiceValue?: number;
  serviceCategory?: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedureName?: string;
  countryName?: string;
  countryAbbreviation?: string;
  officialFee?: number;
  attorneyFee?: number;
  classFee?: number;
  isActive?: boolean;
}

export interface PricingRuleListParams {
  category?: string;
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PricingRuleListResponse {
  pricingRules: PricingRule[];
  total: number;
}

export const pricingRulesService = {
  async list(params?: PricingRuleListParams): Promise<PricingRuleListResponse> {
    const response = await apiClient.get<PricingRuleListResponse>('/api/pricing-rules', { params });
    return response.data;
  },

  async getById(id: string): Promise<PricingRule> {
    const response = await apiClient.get<PricingRule>(`/api/pricing-rules/${id}`);
    return response.data;
  },

  async create(data: CreatePricingRuleDto): Promise<PricingRule> {
    const response = await apiClient.post<PricingRule>('/api/pricing-rules', data);
    return response.data;
  },

  async update(id: string, data: Partial<CreatePricingRuleDto>): Promise<PricingRule> {
    const response = await apiClient.patch<PricingRule>(`/api/pricing-rules/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/pricing-rules/${id}`);
  },
};
