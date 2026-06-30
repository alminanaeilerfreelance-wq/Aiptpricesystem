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
  country?: {
    _id?: string;
    name: string;
    abbreviation: string;
    flagCode?: string;
    isActive?: boolean;
  } | null;
  procedure?: {
    _id?: string;
    name: string;
    serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
    serviceName?: string;
    isActive?: boolean;
  } | null;
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
  countryId?: string;
  procedureId?: string;
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
  status?: 'all' | 'active' | 'inactive';
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

  async listAll(params?: Omit<PricingRuleListParams, 'page' | 'limit'>): Promise<PricingRule[]> {
    const allRules: PricingRule[] = [];
    const limit = 100;
    let page = 1;
    let totalPages = 1;

    do {
      const response = await pricingRulesService.list({ ...params, page, limit });
      allRules.push(...(response.pricingRules || []));
      totalPages = Math.ceil((response.total || allRules.length) / limit) || 1;
      page += 1;
    } while (page <= totalPages);

    return allRules;
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
