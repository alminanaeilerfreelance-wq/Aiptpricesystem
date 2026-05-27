import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aipt_db';

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI in .env.local or .env');
  process.exit(1);
}

const toIdString = (value) => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value._id === 'string') return value._id;
    if (typeof value.id === 'string') return value.id;
    if (typeof value.value === 'string') return value.value;
  }
  return '';
};

const toUniqueObjectIdStrings = (value) => {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const set = new Set();
  for (const item of values) {
    const id = toIdString(item);
    if (id && mongoose.Types.ObjectId.isValid(id)) {
      set.add(id);
    }
  }
  return Array.from(set);
};

const run = async () => {
  await mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB,
    serverSelectionTimeoutMS: 10000,
  });

  const collection = mongoose.connection.collection('inquires');
  const cursor = collection.find(
    {},
    {
      projection: {
        _id: 1,
        procedureId: 1,
        procedureIds: 1,
      },
    }
  );

  let scanned = 0;
  let updated = 0;
  let skippedNoSource = 0;
  const operations = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;
    scanned += 1;

    const existingProcedureIds = toUniqueObjectIdStrings(doc.procedureIds);
    const fallbackProcedureId = toUniqueObjectIdStrings(doc.procedureId)[0];
    const nextProcedureIds =
      existingProcedureIds.length > 0
        ? existingProcedureIds
        : fallbackProcedureId
          ? [fallbackProcedureId]
          : [];

    if (nextProcedureIds.length === 0) {
      skippedNoSource += 1;
      continue;
    }

    const currentPrimary = toUniqueObjectIdStrings(doc.procedureId)[0] || '';
    const nextPrimary = nextProcedureIds[0];
    const alreadySynced =
      existingProcedureIds.length === nextProcedureIds.length &&
      existingProcedureIds.every((id, index) => id === nextProcedureIds[index]) &&
      currentPrimary === nextPrimary;

    if (alreadySynced) continue;

    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            procedureIds: nextProcedureIds.map((id) => new mongoose.Types.ObjectId(id)),
            procedureId: new mongoose.Types.ObjectId(nextPrimary),
          },
        },
      },
    });

    if (operations.length >= 500) {
      const result = await collection.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount || 0;
      operations.length = 0;
    }
  }

  if (operations.length > 0) {
    const result = await collection.bulkWrite(operations, { ordered: false });
    updated += result.modifiedCount || 0;
  }

  console.log('Inquire procedure migration complete');
  console.log(`Scanned: ${scanned}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no source procedure): ${skippedNoSource}`);
};

run()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
