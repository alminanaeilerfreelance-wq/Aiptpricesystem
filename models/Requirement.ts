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

const RequirementModel = (
  mongoose.models.Requirement || mongoose.model<IRequirement>('Requirement', RequirementSchema)
) as Model<IRequirement>;

type RequirementIndex = {
  name?: string;
  key?: Record<string, unknown>;
  unique?: boolean;
};

let legacyUniqueIndexCleanupPromise: Promise<void> | null = null;

export function ensureRequirementDuplicatesAllowed() {
  if (!legacyUniqueIndexCleanupPromise) {
    legacyUniqueIndexCleanupPromise = (async () => {
      try {
        const indexes = await RequirementModel.collection.indexes() as RequirementIndex[];

        const legacyUniqueIndexes = indexes.filter((index) => {
          if (!index.unique || !index.name || index.name === '_id_') return false;

          const keys = Object.keys(index.key ?? {});
          return (
            keys.includes('country') &&
            keys.every((key) => key === 'country' || key === 'serviceCategory')
          );
        });

        await Promise.all(
          legacyUniqueIndexes.map((index) => RequirementModel.collection.dropIndex(index.name as string))
        );
      } catch (error) {
        console.warn('Unable to remove legacy unique requirement indexes:', error);
      }
    })();
  }

  return legacyUniqueIndexCleanupPromise;
}

export default RequirementModel;
