import apiClient from './apiClient';

interface Requirement {
  _id: string;
  country: {
    _id: string;
    name: string;
    code: string;
  };
  requirements: string;
  createdAt: string;
  updatedAt: string;
}

interface RequirementInput {
  country: string;
  serviceCategory?: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
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

interface RequirementListParams {
  page?: number;
  limit?: number;
  search?: string;
  countryId?: string;
  sortBy?: 'createdAt' | 'country';
  sortOrder?: 'asc' | 'desc';
  serviceCategory?: string;
}

const requirementsService = {
  list: (params: RequirementListParams = {}) => {
    const {
      page = 1,
      limit = 10,
      search,
      countryId,
      sortBy,
      sortOrder,
      serviceCategory,
    } = params;

    const searchParams = new URLSearchParams();
    searchParams.append('page', page.toString());
    searchParams.append('limit', limit.toString());
    if (search) searchParams.append('search', search);
    if (countryId) searchParams.append('countryId', countryId);
    if (sortBy) searchParams.append('sortBy', sortBy);
    if (sortOrder) searchParams.append('sortOrder', sortOrder);
    if (serviceCategory) searchParams.append('serviceCategory', serviceCategory);

    return apiClient.get<ListResponse>(`/requirements?${searchParams.toString()}`);
  },

  getById: (id: string) => {
    return apiClient.get<Requirement>(`/requirements/${id}`);
  },

  create: (data: RequirementInput) => {
    return apiClient.post<Requirement>('/requirements', data);
  },

  update: (id: string, data: RequirementInput) => {
    return apiClient.put<Requirement>(`/requirements/${id}`, data);
  },

  delete: (id: string) => {
    return apiClient.delete(`/requirements/${id}`);
  },
};

export default requirementsService;
