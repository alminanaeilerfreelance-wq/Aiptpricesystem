import mongoose, { Document, Model } from 'mongoose';

export type CompanyServiceCategory =
  | 'Trademark'
  | 'Patent'
  | 'Design'
  | 'Copyright'
  | 'Litigation';

export interface ICompanyDetail extends Document {
  continentId: mongoose.Types.ObjectId;
  continentName: string;
  countryId: mongoose.Types.ObjectId;
  countryName: string;
  companyName: string;
  address?: string;
  contact?: string;
  email?: string;
  serviceCategory: CompanyServiceCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companyDetailSchema = new mongoose.Schema<ICompanyDetail>(
  {
    continentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Continent', required: true },
    continentName: { type: String, required: true, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    countryName: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'],
      default: 'Trademark',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companyDetailSchema.index({ companyName: 1 });
companyDetailSchema.index({ continentName: 1 });
companyDetailSchema.index({ countryName: 1 });
companyDetailSchema.index({ serviceCategory: 1 });
companyDetailSchema.index({ email: 1 });
companyDetailSchema.index({ createdAt: -1 });

const CompanyDetail: Model<ICompanyDetail> =
  (mongoose.models.CompanyDetail as Model<ICompanyDetail>) ||
  mongoose.model<ICompanyDetail>('CompanyDetail', companyDetailSchema);

export default CompanyDetail;
