import mongoose, { Document, Model } from 'mongoose';

export interface IClassificationOfFee extends Document {
  description: string;
  remarks: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const classificationOfFeeSchema = new mongoose.Schema<IClassificationOfFee>(
  {
    description: { type: String, required: true, trim: true },
    remarks: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const ClassificationOfFee: Model<IClassificationOfFee> =
  (mongoose.models.ClassificationOfFee as Model<IClassificationOfFee>) ||
  mongoose.model<IClassificationOfFee>('ClassificationOfFee', classificationOfFeeSchema);

export default ClassificationOfFee;
