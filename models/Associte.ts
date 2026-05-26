import mongoose, { Document, Model } from 'mongoose';

export interface IAssocite extends Document {
  assignedId: string;
  associteName: string;
  country?: string;
  continent?: string;
  companyName?: string;
  address?: string;
  email?: string;
  contact?: string;
  notes?: string;
  associteType?: string;
  status?: 'Big' | 'Small' | 'New' | 'Banned';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const associteSchema = new mongoose.Schema<IAssocite>(
  {
    assignedId: { type: String, required: true, trim: true, unique: true },
    associteName: { type: String, required: true, trim: true },
    country: { type: String, trim: true },
    continent: { type: String, trim: true },
    companyName: { type: String, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    contact: { type: String, trim: true },
    notes: { type: String },
    associteType: { type: String, trim: true },
    status: { type: String, enum: ['Big', 'Small', 'New', 'Banned'] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

associteSchema.index({ assignedId: 1 });
associteSchema.index({ associteName: 1 });
associteSchema.index({ country: 1 });
associteSchema.index({ continent: 1 });
associteSchema.index({ status: 1 });

const Associte: Model<IAssocite> =
  (mongoose.models.Associte as Model<IAssocite>) ||
  mongoose.model<IAssocite>('Associte', associteSchema);

export default Associte;
