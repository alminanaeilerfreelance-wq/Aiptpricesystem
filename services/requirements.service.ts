import apiClient from './apiClient';

interface Requirement {
  _id: string;
  country: {
    _id: string;
    name: string;
    code: string;
  };
  procedureId?: string | { _id: string; name?: string; serviceCategory?: string };
  procedureName?: string;
  serviceId?: string | { _id: string; name?: string; category?: string };
  serviceName?: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  title?: string;
  requirements: string;
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RequirementInput {
  country: string;
  procedureId?: string;
  procedureName?: string;
  serviceId?: string;
  serviceName?: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  title: string;
  requirements: string;
  isActive?: boolean;
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
  procedureId?: string;
  procedureName?: string;
  serviceId?: string;
  status?: 'all' | 'active' | 'inactive';
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
      procedureId,
      procedureName,
      serviceId,
      status,
    } = params;

    const searchParams = new URLSearchParams();
    searchParams.append('page', page.toString());
    searchParams.append('limit', limit.toString());
    if (search) searchParams.append('search', search);
    if (countryId) searchParams.append('countryId', countryId);
    if (procedureId) searchParams.append('procedureId', procedureId);
    if (procedureName) searchParams.append('procedureName', procedureName);
    if (serviceId) searchParams.append('serviceId', serviceId);
    if (status) searchParams.append('status', status);
    if (sortBy) searchParams.append('sortBy', sortBy);
    if (sortOrder) searchParams.append('sortOrder', sortOrder);
    if (serviceCategory) searchParams.append('serviceCategory', serviceCategory);

    return apiClient.get<ListResponse>(`/api/requirements?${searchParams.toString()}`);
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
};

export default requirementsService;
