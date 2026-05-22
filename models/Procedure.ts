import mongoose, { Document, Model } from 'mongoose';

export interface IProcedure extends Document {
  name: string;
  description?: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const procedureSchema = new mongoose.Schema<IProcedure>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const Procedure: Model<IProcedure> =
  (mongoose.models.Procedure as Model<IProcedure>) ||
  mongoose.model<IProcedure>('Procedure', procedureSchema);

export default Procedure;
