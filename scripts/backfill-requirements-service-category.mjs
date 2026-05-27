import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aipt_db';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

const requirementSchema = new mongoose.Schema(
  {
    country: { type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true },
    serviceCategory: {
      type: String,
      enum: ['Trademark', 'Patent', 'Copyright', 'Design', 'Litigation'],
    },
    requirements: { type: String, required: true },
  },
  { timestamps: true }
);

const Requirement = mongoose.models.Requirement || mongoose.model('Requirement', requirementSchema);

async function run() {
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });

  const missingFilter = {
    $or: [
      { serviceCategory: { $exists: false } },
      { serviceCategory: null },
      { serviceCategory: '' },
    ],
  };

  const missingCount = await Requirement.countDocuments(missingFilter);

  if (missingCount === 0) {
    console.log('No requirements need backfill.');
    await mongoose.disconnect();
    return;
  }

  const result = await Requirement.updateMany(missingFilter, {
    $set: { serviceCategory: 'Trademark' },
  });

  console.log(`Backfill complete. Updated ${result.modifiedCount} requirement(s).`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error('Backfill failed:', err.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
