import apiClient from './apiClient';
import type { ModulePermission } from '@/lib/permissions';

export interface AuthUserPayload {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  isActive: boolean;
  permissions?: string[];
  modulePermissions?: ModulePermission[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUserPayload;
}

export interface RegisterResponse {
  token?: string;
  user: AuthUserPayload;
  message?: string;
}

export interface MeResponse {
  user: AuthUserPayload;
}

export const authService = {
  /**
   * Authenticate a user with email and password.
   * POST /api/auth/login
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/api/auth/login', { email, password });
    return response.data;
  },

  /**
   * Register a new user account.
   * POST /api/auth/register
   */
  async register(name: string, email: string, password: string): Promise<RegisterResponse> {
    const response = await apiClient.post<RegisterResponse>('/api/auth/register', {
      name,
      email,
      password,
    });
    return response.data;
  },

  /**
   * Log out the currently authenticated user.
   * POST /api/auth/logout
   */
  async logout(): Promise<void> {
    await apiClient.post('/api/auth/logout');
  },

  /**
   * Retrieve the currently authenticated user's profile.
   * GET /api/auth/me
   */
  async getMe(): Promise<MeResponse> {
    const response = await apiClient.get<MeResponse>('/api/auth/me');
    return response.data;
  },
};
