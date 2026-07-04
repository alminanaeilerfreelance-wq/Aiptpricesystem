import mongoose, { Document, Model } from 'mongoose';

export interface IProcedure extends Document {
  name: string;
  description?: string;
  countryId?: mongoose.Types.ObjectId;
  countryName?: string;
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation' | 'Others';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const procedureSchema = new mongoose.Schema<IProcedure>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    countryName: { type: String, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    serviceName: { type: String, required: true, trim: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation', 'Others'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const existingProcedure = mongoose.models.Procedure as Model<IProcedure> | undefined;
const pathIsRequired = (path: string) => {
  const schemaType = existingProcedure?.schema.path(path) as { isRequired?: boolean } | undefined;
  return Boolean(schemaType?.isRequired);
};

if (pathIsRequired('countryId') || pathIsRequired('countryName') || !existingProcedure?.schema.path('description')) {
  delete mongoose.models.Procedure;
}

const Procedure: Model<IProcedure> =
  (mongoose.models.Procedure as Model<IProcedure>) ||
  mongoose.model<IProcedure>('Procedure', procedureSchema);

export default Procedure;
