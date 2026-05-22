import apiClient from './apiClient';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'manager' | 'user';
  isActive?: boolean;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'manager' | 'user';
  isActive?: boolean;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export const usersService = {
  /**
   * Retrieve a list of all users.
   * GET /api/users
   */
  async list(): Promise<UserListResponse> {
    const response = await apiClient.get<UserListResponse>('/api/users');
    return response.data;
  },

  /**
   * Retrieve a single user by ID.
   * GET /api/users/:id
   */
  async getById(id: string): Promise<User> {
    const response = await apiClient.get<User>(`/api/users/${id}`);
    return response.data;
  },

  /**
   * Create a new user.
   * POST /api/users
   */
  async create(data: object): Promise<User> {
    const response = await apiClient.post<User>('/api/users', data);
    return response.data;
  },

  /**
   * Update an existing user.
   * PATCH /api/users/:id
   */
  async update(id: string, data: object): Promise<User> {
    const response = await apiClient.patch<User>(`/api/users/${id}`, data);
    return response.data;
  },

  /**
   * Delete a user.
   * DELETE /api/users/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/users/${id}`);
  },
};
