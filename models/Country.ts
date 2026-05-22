import mongoose, { Document, Model } from 'mongoose';

export interface ICountry extends Document {
  name: string;
  abbreviation: string;
  flagCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const countrySchema = new mongoose.Schema<ICountry>(
  {
    name: { type: String, required: true, trim: true },
    abbreviation: { type: String, required: true, trim: true, uppercase: true },
    flagCode: { type: String, required: true, trim: true, lowercase: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Country: Model<ICountry> =
  (mongoose.models.Country as Model<ICountry>) || mongoose.model<ICountry>('Country', countrySchema);

export default Country;
