import mongoose, { Schema, Document } from 'mongoose';

export interface IRequirement extends Document {
  _id: mongoose.Types.ObjectId;
  country: mongoose.Types.ObjectId;
  service: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  requirements: string;
  createdAt: Date;
  updatedAt: Date;
}

const RequirementSchema = new Schema(
  {
    country: {
      type: Schema.Types.ObjectId,
      ref: 'Country',
      required: true,
    },
    service: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
    },
    requirements: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Indexes to support requirement and country lookup/search.
RequirementSchema.index({ requirements: 'text' });
RequirementSchema.index({ country: 1 });
RequirementSchema.index({ service: 1 });

export default mongoose.models.Requirement || mongoose.model<IRequirement>('Requirement', RequirementSchema);
