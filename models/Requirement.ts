import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRequirement extends Document {
  _id: mongoose.Types.ObjectId;
  country: mongoose.Types.ObjectId;
  serviceCategory: 'Trademark' | 'Patent' | 'Copyright' | 'Design' | 'Litigation';
  title?: string;
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
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
    },
    title: {
      type: String,
      trim: true,
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
RequirementSchema.index({ title: 1 });
RequirementSchema.index({ country: 1 });
RequirementSchema.index({ serviceCategory: 1 });

const existingRequirement = mongoose.models.Requirement as Model<IRequirement> | undefined;
if (existingRequirement && !existingRequirement.schema.path('title')) {
  delete mongoose.models.Requirement;
}

export default mongoose.models.Requirement || mongoose.model<IRequirement>('Requirement', RequirementSchema);
