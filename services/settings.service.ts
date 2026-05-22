import apiClient from './apiClient';

export interface Settings {
  _id?: string;
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  currency: string;
  defaultValidDays: number;
  logoUrl?: string;
  termsAndConditions?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  updatedAt?: string;
}

export const settingsService = {
  /**
   * Retrieve the current application settings.
   * GET /api/settings
   */
  async get(): Promise<Settings> {
    const response = await apiClient.get<Settings>('/api/settings');
    return response.data;
  },

  /**
   * Update the application settings.
   * PATCH /api/settings
   */
  async update(data: object): Promise<Settings> {
    const response = await apiClient.patch<Settings>('/api/settings', data);
    return response.data;
  },
};
