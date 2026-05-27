import mongoose, { Document, Model } from 'mongoose';

export interface IProcedure extends Document {
  name: string;
  countryId: mongoose.Types.ObjectId;
  countryName: string;
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const procedureSchema = new mongoose.Schema<IProcedure>(
  {
    name: { type: String, required: true, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    countryName: { type: String, required: true, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true, trim: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Procedure: Model<IProcedure> =
  (mongoose.models.Procedure as Model<IProcedure>) ||
  mongoose.model<IProcedure>('Procedure', procedureSchema);

export default Procedure;
