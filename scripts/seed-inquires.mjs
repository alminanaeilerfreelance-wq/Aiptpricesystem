import mongoose from 'mongoose';
import { config } from 'dotenv';

config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || 'aipt_db';
const SEED_MARKER = '[SEED-MULTI-PROC]';

if (!MONGODB_URI) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

const serviceSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const procedureSchema = new mongoose.Schema(
  {
    name: String,
    serviceCategory: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const countrySchema = new mongoose.Schema(
  {
    name: String,
    abbreviation: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const clientSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const inquireSchema = new mongoose.Schema(
  {
    inquiryDate: { type: Date, required: true },
    referenceNo: { type: String, required: true, unique: true },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    procedureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Procedure' },
    procedureIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Procedure', required: true }],
    countryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Country', required: true }],
    countryCodes: [{ type: String }],
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    remarks: { type: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Service = mongoose.models.Service || mongoose.model('Service', serviceSchema);
const Procedure = mongoose.models.Procedure || mongoose.model('Procedure', procedureSchema);
const Country = mongoose.models.Country || mongoose.model('Country', countrySchema);
const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);
const Inquire = mongoose.models.Inquire || mongoose.model('Inquire', inquireSchema);

const normalizeCountryCode = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);

const formatSerial = (value) => String(value).padStart(5, '0');

const pickCircular = (items, startIndex, count) => {
  if (!Array.isArray(items) || items.length === 0 || count <= 0) return [];
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    picked.push(items[(startIndex + i) % items.length]);
  }
  return picked;
};

const getMaxReferenceSerial = async () => {
  const rows = await Inquire.find({}, { referenceNo: 1 }).lean();
  let max = 0;
  for (const row of rows) {
    const match = String(row.referenceNo || '').match(/^(\d{5})/);
    if (!match) continue;
    const current = Number(match[1]);
    if (Number.isFinite(current) && current > max) {
      max = current;
    }
  }
  return max;
};

async function seedInquires() {
  console.log('\nSeeding inquires with multi-procedure data...\n');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });

  const [services, procedures, countries, clients] = await Promise.all([
    Service.find({ isActive: { $ne: false } }).lean(),
    Procedure.find({ isActive: { $ne: false } }).lean(),
    Country.find({ isActive: { $ne: false } }).lean(),
    Client.find({ isActive: { $ne: false } }).lean(),
  ]);

  if (services.length === 0) throw new Error('No active services found');
  if (procedures.length === 0) throw new Error('No active procedures found');
  if (countries.length < 2) throw new Error('At least 2 active countries are required');
  if (clients.length === 0) throw new Error('No active clients found');

  const removal = await Inquire.deleteMany({
    remarks: { $regex: `^${SEED_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` },
  });

  const maxSerial = await getMaxReferenceSerial();
  const existingRefs = new Set(
    (await Inquire.find({}, { referenceNo: 1 }).lean()).map((row) => String(row.referenceNo || ''))
  );

  let serial = maxSerial + 1;
  const docs = [];
  let cursor = 0;

  for (const service of services) {
    const serviceProcedures = procedures.filter(
      (procedure) => String(procedure.serviceCategory || '') === String(service.category || '')
    );

    if (serviceProcedures.length < 2) {
      continue;
    }

    for (let variant = 0; variant < 2; variant += 1) {
      const selectedProcedures = pickCircular(serviceProcedures, variant, Math.min(3, serviceProcedures.length));
      const selectedCountries = pickCircular(countries, cursor + variant, 2);
      const countryCodes = selectedCountries
        .map((country) => normalizeCountryCode(country.abbreviation))
        .filter(Boolean);

      if (selectedProcedures.length < 2 || selectedCountries.length < 2 || countryCodes.length === 0) {
        continue;
      }

      let referenceNo = `${formatSerial(serial)}${countryCodes.join('/')}`;
      while (existingRefs.has(referenceNo)) {
        serial += 1;
        referenceNo = `${formatSerial(serial)}${countryCodes.join('/')}`;
      }
      existingRefs.add(referenceNo);

      docs.push({
        inquiryDate: new Date(Date.now() - cursor * 24 * 60 * 60 * 1000),
        referenceNo,
        serviceId: service._id,
        procedureId: selectedProcedures[0]._id,
        procedureIds: selectedProcedures.map((procedure) => procedure._id),
        countryIds: selectedCountries.map((country) => country._id),
        countryCodes,
        clientId: clients[cursor % clients.length]._id,
        remarks: `${SEED_MARKER} ${service.category} sample ${variant + 1}`,
        isActive: true,
      });

      serial += 1;
      cursor += 1;
    }
  }

  if (docs.length === 0) {
    throw new Error('No seedable inquire rows were generated. Ensure each service has at least 2 procedures.');
  }

  await Inquire.insertMany(docs, { ordered: true });

  console.log(`Removed previous seeded inquires: ${removal.deletedCount || 0}`);
  console.log(`Created seeded inquires: ${docs.length}`);
  console.log(`Each seeded record includes multiple procedureIds and multiple countryIds.\n`);

  await mongoose.disconnect();
}

seedInquires().catch(async (err) => {
  console.error(`Seed failed: ${err.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    // noop
  }
  process.exit(1);
});

