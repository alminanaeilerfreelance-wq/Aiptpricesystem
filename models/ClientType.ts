import mongoose, { Document, Model } from 'mongoose';

export interface IClientType extends Document {
  name: string;
  description?: string;
  multiplier: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const clientTypeSchema = new mongoose.Schema<IClientType>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    multiplier: { type: Number, default: 1.0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ClientType: Model<IClientType> =
  (mongoose.models.ClientType as Model<IClientType>) ||
  mongoose.model<IClientType>('ClientType', clientTypeSchema);

export default ClientType;
