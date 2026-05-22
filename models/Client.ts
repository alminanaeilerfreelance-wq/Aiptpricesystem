import mongoose, { Document, Model } from 'mongoose';

export interface IClient extends Document {
  name: string;
  email?: string;
  phone?: string;
  country?: string;
  continent?: string;
  address?: string;
  city?: string;
  companyName?: string;
  type: 'Individual' | 'Company' | 'Organization';
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
    type: { type: String, enum: ['Individual', 'Company', 'Organization'], default: 'Company' },
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

const Client: Model<IClient> =
  (mongoose.models.Client as Model<IClient>) || mongoose.model<IClient>('Client', clientSchema);

export default Client;
