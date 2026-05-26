import apiClient from './apiClient';

export interface Department {
  _id: string;
  name: string;
  country?: string | {
    _id?: string;
    name?: string;
  } | null;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentDto {
  name: string;
  country?: string;
  description?: string;
  isActive?: boolean;
}

export interface DepartmentListParams {
  search?: string;
  country?: string;
  page?: number;
  limit?: number;
}

export interface DepartmentListResponse {
  departments: Department[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export const departmentsService = {
  /**
   * Retrieve a list of departments with optional filters.
   * GET /api/departments
   */
  async list(params?: DepartmentListParams): Promise<DepartmentListResponse> {
    const response = await apiClient.get<DepartmentListResponse>('/api/departments', { params });
    return response.data;
  },

  /**
   * Retrieve a single department by ID.
   * GET /api/departments/:id
   */
  async getById(id: string): Promise<Department> {
    const response = await apiClient.get<Department>(`/api/departments/${id}`);
    return response.data;
  },

  /**
   * Create a new department.
   * POST /api/departments
   */
  async create(data: object): Promise<Department> {
    const response = await apiClient.post<Department>('/api/departments', data);
    return response.data;
  },

  /**
   * Update an existing department.
   * PATCH /api/departments/:id
   */
  async update(id: string, data: object): Promise<Department> {
    const response = await apiClient.patch<Department>(`/api/departments/${id}`, data);
    return response.data;
  },

  /**
   * Delete a department.
   * DELETE /api/departments/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/departments/${id}`);
  },
};
