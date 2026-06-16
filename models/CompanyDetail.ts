import mongoose, { Document, Model } from 'mongoose';

export type CompanyServiceCategory =
  | 'Trademark'
  | 'Patent'
  | 'Design'
  | 'Copyright'
  | 'Litigation';

export interface ICompanyDetail extends Document {
  continentId?: mongoose.Types.ObjectId;
  continentName?: string;
  countryId?: mongoose.Types.ObjectId;
  countryName?: string;
  companyName: string;
  address?: string;
  contact?: string;
  email?: string;
  logoUrl?: string;
  serviceCategory?: CompanyServiceCategory;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const companyDetailSchema = new mongoose.Schema<ICompanyDetail>(
  {
    continentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Continent' },
    continentName: { type: String, trim: true },
    countryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Country' },
    countryName: { type: String, trim: true },
    companyName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    contact: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    logoUrl: { type: String, trim: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Design', 'Copyright', 'Litigation'],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

companyDetailSchema.index({ companyName: 1 });
companyDetailSchema.index({ email: 1 });
companyDetailSchema.index({ createdAt: -1 });

if (mongoose.models.CompanyDetail) {
  mongoose.deleteModel('CompanyDetail');
}

const CompanyDetail: Model<ICompanyDetail> = mongoose.model<ICompanyDetail>(
  'CompanyDetail',
  companyDetailSchema
);

export default CompanyDetail;
