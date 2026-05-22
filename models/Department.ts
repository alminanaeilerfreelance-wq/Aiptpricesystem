import mongoose, { Document, Model } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  country?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const departmentSchema = new mongoose.Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    country: { type: String, trim: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

departmentSchema.index({ name: 1 });
departmentSchema.index({ country: 1 });

const Department: Model<IDepartment> =
  (mongoose.models.Department as Model<IDepartment>) ||
  mongoose.model<IDepartment>('Department', departmentSchema);

export default Department;
