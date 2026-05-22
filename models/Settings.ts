import mongoose, { Document, Model } from 'mongoose';

export interface ISettings extends Document {
  companyName: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  currency: string;
  defaultValidDays: number;
  logoUrl?: string;
  termsAndConditions?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  updatedAt: Date;
}

const settingsSchema = new mongoose.Schema<ISettings>(
  {
    companyName: { type: String, default: 'IP Law Firm' },
    companyEmail: { type: String },
    companyPhone: { type: String },
    companyAddress: { type: String },
    currency: { type: String, default: 'SAR' },
    defaultValidDays: { type: Number, default: 30 },
    logoUrl: { type: String },
    termsAndConditions: { type: String, default: 'This quotation is valid for the specified number of days from the issue date.' },
    smtpHost: { type: String },
    smtpPort: { type: Number },
    smtpUser: { type: String },
    smtpPass: { type: String },
  },
  { timestamps: true }
);

const Settings: Model<ISettings> =
  (mongoose.models.Settings as Model<ISettings>) ||
  mongoose.model<ISettings>('Settings', settingsSchema);

export default Settings;
