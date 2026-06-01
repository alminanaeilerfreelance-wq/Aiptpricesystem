import apiClient from './apiClient';
import type { ModulePermission } from '@/lib/permissions';

export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: string[];
  modulePermissions: ModulePermission[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleDto {
  name: string;
  description?: string;
  permissions?: string[];
  modulePermissions: ModulePermission[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
  modulePermissions?: ModulePermission[];
}

export interface RoleListResponse {
  roles: Role[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface RoleListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const rolesService = {
  async list(params?: RoleListParams): Promise<RoleListResponse> {
    const response = await apiClient.get<RoleListResponse>('/api/roles', { params });
    return response.data;
  },

  async getById(id: string): Promise<Role> {
    const response = await apiClient.get<Role>(`/api/roles/${id}`);
    return response.data;
  },

  async create(data: CreateRoleDto): Promise<Role> {
    const response = await apiClient.post<Role>('/api/roles', data);
    return response.data;
  },

  async update(id: string, data: UpdateRoleDto): Promise<Role> {
    const response = await apiClient.put<Role>(`/api/roles/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/roles/${id}`);
  },
};
