import mongoose, { Document, Model } from 'mongoose';

export interface IPricingRule extends Document {
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  procedureName: string;
  countryName: string;
  countryAbbreviation: string;
  officialFee: number;
  attorneyFee: number;
  classFee: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pricingRuleSchema = new mongoose.Schema<IPricingRule>(
  {
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
      required: true,
    },
    procedureName: { type: String, required: true, trim: true },
    countryName: { type: String, required: true, trim: true },
    countryAbbreviation: { type: String, required: true, trim: true, uppercase: true },
    officialFee: { type: Number, default: 0 },
    attorneyFee: { type: Number, default: 0 },
    classFee: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

pricingRuleSchema.index({ serviceCategory: 1, countryName: 1, procedureName: 1 });

const PricingRule: Model<IPricingRule> =
  (mongoose.models.PricingRule as Model<IPricingRule>) ||
  mongoose.model<IPricingRule>('PricingRule', pricingRuleSchema);

export default PricingRule;
