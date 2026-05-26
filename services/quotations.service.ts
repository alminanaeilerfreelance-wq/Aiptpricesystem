import apiClient from './apiClient';

export interface QuotationFees {
  governmentFee: number;
  serviceFee: number;
  classFee: number;
  procedureFee: number;
}

export interface QuotationRequirement {
  _id: string;
  requirements: string;
  country?: {
    _id: string;
    name: string;
    abbreviation?: string;
  };
}

export interface Quotation {
  _id: string;
  quotationNo: string;
  clientId?: string;
  associteId?: string;
  clientName: string;
  clientEmail?: string;
  clientType?: string;
  inquiriesProject?: string;
  service: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedure: string;
  country: string;
  numberOfClasses: number;
  requirementIds?: string[] | QuotationRequirement[];
  fees: QuotationFees;
  multiplier: number;
  subtotal: number;
  total: number;
  currency: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  validDays: number;
  notes?: string;
  createdBy?: string;
  approvedBy?: string;
  approvalDate?: string;
  createdAt: string;
  updatedAt: string;
  pdfAccessToken?: string;
}

export interface CreateQuotationDto {
  clientId?: string;
  associteId?: string;
  clientName: string;
  clientEmail?: string;
  clientType?: string;
  inquiriesProject?: string;
  service: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedure: string;
  country: string;
  numberOfClasses?: number;
  requirementIds?: string[];
  fees?: Partial<QuotationFees>;
  multiplier?: number;
  currency?: string;
  status?: 'Draft' | 'Pending' | 'Approved' | 'Rejected';
  validDays?: number;
  notes?: string;
}

export interface QuotationListParams {
  status?: string;
  search?: string;
  service?: string;
  country?: string;
  page?: number;
  limit?: number;
}

export interface QuotationListResponse {
  quotations: Quotation[];
  total: number;
  page?: number;
  limit?: number;
}

export const quotationsService = {
  /**
   * Retrieve a list of quotations with optional filters.
   * GET /api/quotations
   */
  async list(params?: QuotationListParams): Promise<QuotationListResponse> {
    const response = await apiClient.get<QuotationListResponse>('/api/quotations', { params });
    return response.data;
  },

  /**
   * Retrieve a single quotation by ID.
   * GET /api/quotations/:id
   */
  async getById(id: string): Promise<Quotation> {
    const response = await apiClient.get<Quotation>(`/api/quotations/${id}`);
    return response.data;
  },

  /**
   * Create a new quotation.
   * POST /api/quotations
   */
  async create(data: CreateQuotationDto): Promise<Quotation> {
    const response = await apiClient.post<Quotation>('/api/quotations', data);
    return response.data;
  },

  /**
   * Update an existing quotation.
   * PATCH /api/quotations/:id
   */
  async update(id: string, data: Partial<CreateQuotationDto>): Promise<Quotation> {
    const response = await apiClient.patch<Quotation>(`/api/quotations/${id}`, data);
    return response.data;
  },

  /**
   * Delete a quotation.
   * DELETE /api/quotations/:id
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/quotations/${id}`);
  },

  /**
   * Approve a quotation, changing its status to Approved.
   * POST /api/quotations/:id/approve
   */
  async approve(id: string): Promise<Quotation> {
    const response = await apiClient.patch<Quotation>(`/api/quotations/${id}/approve`);
    return response.data;
  },

  /**
   * Send the quotation PDF via email to the given address.
   * POST /api/quotations/:id/send-email
   */
  async sendEmail(id: string, email: string): Promise<{ message: string }> {
    const response = await apiClient.post<{ message: string }>(
      `/api/quotations/${id}/send-email`,
      { email }
    );
    return response.data;
  },
};
