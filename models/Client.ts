import mongoose, { Document, Model } from 'mongoose';

export const CLIENT_TYPE_VALUES = ['Agent', 'Direct'] as const;
export type ClientType = (typeof CLIENT_TYPE_VALUES)[number];

export const normalizeClientType = (value: unknown): ClientType => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'agent' ? 'Agent' : 'Direct';
};

export interface IClient extends Document {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  continent?: string;
  address?: string;
  city?: string;
  companyName?: string;
  type: ClientType;
  registrationNumber?: string;
  taxId?: string;
  notes?: string;
  status?: 'Big' | 'Small' | 'New' | 'Banned';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new mongoose.Schema<IClient>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    continent: { type: String, trim: true },
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    companyName: { type: String, trim: true },
    type: { type: String, enum: CLIENT_TYPE_VALUES, default: 'Direct' },
    registrationNumber: { type: String, trim: true },
    taxId: { type: String, trim: true },
    notes: { type: String },
    status: { type: String, enum: ['Big', 'Small', 'New', 'Banned'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clientSchema.index({ email: 1 });
clientSchema.index({ name: 1 });
clientSchema.index({ status: 1 });

const existingClient = mongoose.models.Client as Model<IClient> | undefined;
const existingTypePath = existingClient?.schema.path('type') as
  | { enumValues?: string[] }
  | undefined;
const existingTypeEnum = existingTypePath?.enumValues || [];

if (
  existingClient &&
  (!existingTypeEnum.includes('Agent') || !existingTypeEnum.includes('Direct'))
) {
  delete mongoose.models.Client;
}

const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) || mongoose.model<IClient>('Client', clientSchema);

export default Client;
