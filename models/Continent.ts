import mongoose, { Document, Model } from 'mongoose';

export interface IContinent extends Document {
  continent: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const continentSchema = new mongoose.Schema<IContinent>(
  {
    continent: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Continent: Model<IContinent> =
  (mongoose.models.Continent as Model<IContinent>) ||
  mongoose.model<IContinent>('Continent', continentSchema);

export default Continent;
