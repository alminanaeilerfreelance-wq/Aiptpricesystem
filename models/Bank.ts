import mongoose, { Document, Model } from 'mongoose';

export interface IBank extends Document {
  bankName: string;
  logoUrl?: string;
  bankHeader: string;
  bankDescription: string;
  accountName?: string;
  accountNumber?: string;
  iban?: string;
  swift?: string;
  currency?: string;
  status: 'Active' | 'Abandon' | 'Cancel';
  createdAt: Date;
  updatedAt: Date;
}

const bankSchema = new mongoose.Schema<IBank>(
  {
    bankName: { type: String, required: true, trim: true, index: true },
    logoUrl: { type: String, trim: true },
    bankHeader: { type: String, required: true, trim: true },
    bankDescription: { type: String, required: true, trim: true },
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    iban: { type: String, trim: true },
    swift: { type: String, trim: true },
    currency: { type: String, trim: true, default: 'US$' },
    status: { type: String, enum: ['Active', 'Abandon', 'Cancel'], default: 'Active', index: true },
  },
  { timestamps: true }
);

const Bank: Model<IBank> = (mongoose.models.Bank as Model<IBank>) || mongoose.model<IBank>('Bank', bankSchema);

export default Bank;
