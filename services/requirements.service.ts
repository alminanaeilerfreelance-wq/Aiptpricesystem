import apiClient from './apiClient';

interface Requirement {
  _id: string;
  country: {
    _id: string;
    name: string;
    abbreviation?: string;
    code?: string;
  };
  requirements: string;
  createdAt: string;
  updatedAt: string;
}

interface RequirementInput {
  country: string;
  requirements: string;
  upsertByCountry?: boolean;
}

interface ListResponse {
  data: Requirement[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

interface UsedCountriesResponse {
  countryIds: string[];
}

const requirementsService = {
  list: (
    page: number = 1,
    limit: number = 10,
    search?: string,
    countryId?: string,
    sortBy?: 'createdAt' | 'country',
    sortOrder?: 'asc' | 'desc'
  ) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (countryId) params.append('countryId', countryId);
    if (sortBy) params.append('sortBy', sortBy);
    if (sortOrder) params.append('sortOrder', sortOrder);

    return apiClient.get<ListResponse>(`/api/requirements?${params.toString()}`);
  },

  getById: (id: string) => {
    return apiClient.get<Requirement>(`/api/requirements/${id}`);
  },

  create: (data: RequirementInput) => {
    return apiClient.post<Requirement>('/api/requirements', data);
  },

  update: (id: string, data: RequirementInput) => {
    return apiClient.put<Requirement>(`/api/requirements/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/api/requirements/${id}`);
  },

  getUsedCountryIds: () => {
    return apiClient.get<UsedCountriesResponse>('/api/requirements/countries-in-use');
  },
};

export default requirementsService;
