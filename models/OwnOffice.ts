import mongoose, { Document, Model } from 'mongoose';

export interface IOwnOffice extends Document {
  country: string;
  companyName: string;
  address?: string;
  tax?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ownOfficeSchema = new mongoose.Schema<IOwnOffice>(
  {
    country: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    tax: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

ownOfficeSchema.index({ country: 1 });
ownOfficeSchema.index({ companyName: 1 });
ownOfficeSchema.index({ tax: 1 });

const OwnOffice: Model<IOwnOffice> =
  (mongoose.models.OwnOffice as Model<IOwnOffice>) ||
  mongoose.model<IOwnOffice>('OwnOffice', ownOfficeSchema);

export default OwnOffice;
