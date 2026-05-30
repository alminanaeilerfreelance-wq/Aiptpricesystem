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
  requirements: string;
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

const requirementsService = {
  list: (page: number = 1, limit: number = 10, search?: string, countryId?: string) => {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (countryId) params.append('countryId', countryId);

    return apiClient.get<ListResponse>(`/requirements?${params.toString()}`);
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
