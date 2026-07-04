import mongoose, { Document, Model } from 'mongoose';

export const CLIENT_TYPE_VALUES = ['Agent', 'Direct'] as const;
export type ClientType = (typeof CLIENT_TYPE_VALUES)[number];

export const CLIENT_SERVICE_TYPE_VALUES = ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'] as const;
export type ClientServiceType = (typeof CLIENT_SERVICE_TYPE_VALUES)[number];

export const normalizeClientType = (value: unknown): ClientType => {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'agent' ? 'Agent' : 'Direct';
};

export const normalizeClientServiceType = (value: unknown): ClientServiceType | undefined => {
  const normalized = String(value ?? '').trim();
  return CLIENT_SERVICE_TYPE_VALUES.includes(normalized as ClientServiceType)
    ? (normalized as ClientServiceType)
    : undefined;
};

export interface IClient extends Document {
  assignedId?: string;
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  address?: string;
  companyName?: string;
  assignedServiceType?: ClientServiceType;
  assignedIdCount?: number;
  type: ClientType;
  notes?: string;
  status?: 'Big' | 'Small' | 'New' | 'Banned';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientSchema = new mongoose.Schema<IClient>(
  {
    assignedId: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    country: { type: String, trim: true },
    address: { type: String, trim: true },
    companyName: { type: String, trim: true },
    assignedServiceType: { type: String, enum: CLIENT_SERVICE_TYPE_VALUES },
    assignedIdCount: { type: Number, min: 0 },
    type: { type: String, enum: CLIENT_TYPE_VALUES, default: 'Direct' },
    notes: { type: String },
    status: { type: String, enum: ['Big', 'Small', 'New', 'Banned'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

clientSchema.index({ email: 1 });
clientSchema.index({ name: 1 });
clientSchema.index({ status: 1 });
clientSchema.index({ assignedId: 1 });

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
