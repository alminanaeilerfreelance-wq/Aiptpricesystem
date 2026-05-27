import mongoose, { Document, Model } from 'mongoose';

export interface IInquire extends Document {
  inquiryDate: Date;
  referenceNo: string;
  serviceId: mongoose.Types.ObjectId;
  procedureId?: mongoose.Types.ObjectId;
  procedureIds: mongoose.Types.ObjectId[];
  countryIds: mongoose.Types.ObjectId[];
  countryCodes: string[];
  clientId: mongoose.Types.ObjectId;
  remarks?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const inquireSchema = new mongoose.Schema<IInquire>(
  {
    inquiryDate: { type: Date, required: true },
    referenceNo: { type: String, required: true, trim: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' },
    procedureIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' }],
      required: true,
      validate: {
        validator: (value: mongoose.Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
        message: 'At least one procedure is required',
      },
    },
    countryIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Country' }],
      required: true,
      validate: {
        validator: (value: mongoose.Types.ObjectId[]) => Array.isArray(value) && value.length > 0,
        message: 'At least one country is required',
      },
    },
    countryCodes: [{ type: String, trim: true, uppercase: true }],
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    remarks: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

inquireSchema.pre('validate', function (next) {
  if ((!this.procedureId || typeof this.procedureId === 'undefined') && Array.isArray(this.procedureIds) && this.procedureIds.length > 0) {
    this.procedureId = this.procedureIds[0];
  }
  next();
});

inquireSchema.index({ referenceNo: 1 });
inquireSchema.index({ inquiryDate: -1 });
inquireSchema.index({ serviceId: 1 });
inquireSchema.index({ procedureId: 1 });
inquireSchema.index({ procedureIds: 1 });
inquireSchema.index({ countryIds: 1 });
inquireSchema.index({ clientId: 1 });

const Inquire: Model<IInquire> =
  (mongoose.models.Inquire as Model<IInquire>) ||
  mongoose.model<IInquire>('Inquire', inquireSchema);

export default Inquire;
