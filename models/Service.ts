import mongoose, { Document, Model } from 'mongoose';

export interface IService extends Document {
  name: string;
  description?: string;
  category: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  basePrice: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const serviceSchema = new mongoose.Schema<IService>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    basePrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Service: Model<IService> =
  (mongoose.models.Service as Model<IService>) || mongoose.model<IService>('Service', serviceSchema);

export default Service;
